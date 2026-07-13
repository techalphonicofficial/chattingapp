import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  Order,
  OrderItem,
  fetchOrderDetails,
  formatINR,
  formatOrderDate,
  getProductImages,
  getStatusStyle,
} from '../services/orderApi';

type OrderDetailRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'OrderDetail'>;

const GALLERY_HEIGHT = 280;
const THUMB_SIZE = 64;
const AUTO_SWIPE_MS = 3500;

const ProductImageGallery = ({ images }: { images: string[] }) => {
  const { width: screenWidth } = useWindowDimensions();
  const galleryWidth = screenWidth - 56;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUserSwiping, setIsUserSwiping] = useState(false);
  const listRef = useRef<FlatList<string>>(null);
  const thumbRef = useRef<ScrollView>(null);

  const scrollToIndex = (index: number, animated = true) => {
    if (index < 0 || index >= images.length) return;
    setActiveIndex(index);
    listRef.current?.scrollToOffset({ offset: galleryWidth * index, animated });
    thumbRef.current?.scrollTo({
      x: Math.max(0, index * (THUMB_SIZE + 8) - galleryWidth / 2 + THUMB_SIZE),
      animated,
    });
  };

  const onGalleryScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / galleryWidth);
    if (index >= 0 && index < images.length && index !== activeIndex) {
      setActiveIndex(index);
      thumbRef.current?.scrollTo({
        x: Math.max(0, index * (THUMB_SIZE + 8) - galleryWidth / 2 + THUMB_SIZE),
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (images.length <= 1 || isUserSwiping) return undefined;

    const timer = setInterval(() => {
      const nextIndex = (activeIndex + 1) % images.length;
      scrollToIndex(nextIndex, true);
    }, AUTO_SWIPE_MS);

    return () => clearInterval(timer);
  }, [activeIndex, images.length, isUserSwiping, galleryWidth]);

  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [images]);

  if (images.length === 0) {
    return (
      <View style={[styles.galleryMain, styles.galleryPlaceholder, { width: galleryWidth }]}>
        <MaterialIcons name="image" size={40} color="#bbb" />
      </View>
    );
  }

  return (
    <View style={styles.galleryWrap}>
      <FlatList
        ref={listRef}
        data={images}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        keyExtractor={(uri, index) => `${uri}-${index}`}
        onScrollBeginDrag={() => setIsUserSwiping(true)}
        onMomentumScrollEnd={(e) => {
          onGalleryScroll(e);
          setTimeout(() => setIsUserSwiping(false), 2000);
        }}
        onScrollEndDrag={onGalleryScroll}
        getItemLayout={(_, index) => ({
          length: galleryWidth,
          offset: galleryWidth * index,
          index,
        })}
        renderItem={({ item: uri }) => (
          <View style={[styles.gallerySlide, { width: galleryWidth }]}>
            <Image source={{ uri }} style={styles.galleryImage} resizeMode="contain" />
          </View>
        )}
      />

      {images.length > 1 ? (
        <>
          <ScrollView
            ref={thumbRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbRow}
            nestedScrollEnabled
          >
            {images.map((uri, index) => (
              <TouchableOpacity
                key={`${uri}-${index}`}
                onPress={() => {
                  setIsUserSwiping(true);
                  scrollToIndex(index, true);
                  setTimeout(() => setIsUserSwiping(false), 2500);
                }}
                activeOpacity={0.85}
                style={[
                  styles.thumbWrap,
                  index === activeIndex && styles.thumbWrapActive,
                ]}
              >
                <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.dotsRow}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
};

const OrderDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<OrderDetailRouteProp>();
  const { token, orderNumber } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchOrderDetails(token, orderNumber);
        setOrder(data);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Could not load order details', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, orderNumber, navigation]);

  const statusStyle = order ? getStatusStyle(order.status) : null;

  const renderOrderItem = (item: OrderItem) => {
    const productImages = getProductImages(item);
    const productName = item.variant?.product?.name || 'Product';
    const lineTotal = parseFloat(item.unit_price) * item.quantity;

    return (
      <View key={item.id} style={styles.itemCard}>
        <ProductImageGallery images={productImages} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{productName}</Text>
          {item.variant?.sku ? (
            <Text style={styles.itemSku}>SKU: {item.variant.sku}</Text>
          ) : null}
          <Text style={styles.itemQty}>
            Qty: {item.quantity} × {formatINR(item.unit_price)}
          </Text>
          <View style={styles.itemFooter}>
            <View style={[styles.itemStatusBadge, { backgroundColor: getStatusStyle(item.status).bg }]}>
              <Text style={[styles.itemStatusText, { color: getStatusStyle(item.status).text }]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatINR(lineTotal)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0052CC" />
      <View style={{ height: insets.top, backgroundColor: '#0052CC' }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Order Details</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052CC" />
        </View>
      ) : order ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <Text style={styles.orderDate}>{formatOrderDate(order.created_at)}</Text>
            {statusStyle && (
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                  {order.status?.toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.grandTotal}>{formatINR(order.total_amount)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Items</Text>
          {(order.items || []).map(renderOrderItem)}

          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Method</Text>
              <Text style={styles.infoValue}>{order.payment_method || '—'}</Text>
            </View>
            {order.coupon_code ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Coupon</Text>
                <Text style={styles.infoValue}>{order.coupon_code}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Discount</Text>
              <Text style={styles.infoValue}>{formatINR(order.discount_amount || '0')}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabelBold}>Total Paid</Text>
              <Text style={styles.infoValueBold}>{formatINR(order.total_amount)}</Text>
            </View>
          </View>

          {order.shipping_address ? (
            <>
              <Text style={styles.sectionTitle}>Shipping Address</Text>
              <View style={styles.infoCard}>
                <Text style={styles.addressName}>{order.shipping_address.full_name}</Text>
                <Text style={styles.addressLine}>{order.shipping_address.street}</Text>
                <Text style={styles.addressLine}>
                  {order.shipping_address.city}
                  {order.shipping_address.postal_code ? ` - ${order.shipping_address.postal_code}` : ''}
                </Text>
                {order.shipping_address.phone ? (
                  <Text style={styles.addressPhone}>📞 {order.shipping_address.phone}</Text>
                ) : null}
                {order.shipping_address.address_type ? (
                  <Text style={styles.addressType}>{order.shipping_address.address_type}</Text>
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0052CC',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  orderNumber: { fontSize: 16, fontWeight: '700', color: '#111' },
  orderDate: { fontSize: 13, color: '#666', marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  grandTotal: { fontSize: 28, fontWeight: '800', color: '#0052CC', marginTop: 14 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0052CC',
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    overflow: 'hidden',
  },
  galleryWrap: { marginBottom: 12 },
  galleryMain: {
    height: GALLERY_HEIGHT,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholder: { alignSelf: 'center' },
  gallerySlide: {
    height: GALLERY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  galleryImage: { width: '100%', height: GALLERY_HEIGHT },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#0052CC',
  },
  thumbRow: {
    paddingTop: 10,
    paddingHorizontal: 2,
    gap: 8,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    marginRight: 8,
  },
  thumbWrapActive: {
    borderColor: '#0052CC',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#111' },
  itemSku: { fontSize: 11, color: '#888', marginTop: 2 },
  itemQty: { fontSize: 13, color: '#555', marginTop: 6 },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  itemStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  itemTotal: { fontSize: 15, fontWeight: '800', color: '#0052CC' },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoRowLast: { borderBottomWidth: 0, paddingTop: 12 },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#111', fontWeight: '600', textTransform: 'capitalize' },
  infoLabelBold: { fontSize: 15, fontWeight: '700', color: '#111' },
  infoValueBold: { fontSize: 16, fontWeight: '800', color: '#0052CC' },
  addressName: { fontSize: 16, fontWeight: '700', color: '#111' },
  addressLine: { fontSize: 14, color: '#444', marginTop: 6, lineHeight: 20 },
  addressPhone: { fontSize: 14, color: '#0052CC', marginTop: 10, fontWeight: '600' },
  addressType: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textTransform: 'capitalize',
    fontStyle: 'italic',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default OrderDetailScreen;
