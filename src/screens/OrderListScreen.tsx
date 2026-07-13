import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  Order,
  fetchCustomerOrders,
  formatINR,
  formatOrderDate,
  getStatusStyle,
} from '../services/orderApi';

type OrderListRouteProp = RouteProp<RootStackParamList, 'OrderList'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'OrderList'>;

const OrderListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<OrderListRouteProp>();
  const { token } = route.params;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const list = await fetchCustomerOrders(token);
      setOrders(list);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not load your orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [token]),
  );

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusStyle = getStatusStyle(item.status);
    const itemCount = item.items?.length ?? 0;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() =>
          navigation.navigate('OrderDetail', {
            token,
            orderNumber: item.order_number,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.orderTop}>
          <View style={styles.orderIcon}>
            <MaterialIcons name="receipt-long" size={22} color="#0052CC" />
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{item.order_number}</Text>
            <Text style={styles.orderDate}>{formatOrderDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.orderBottom}>
          <Text style={styles.itemCount}>
            {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? 's' : ''}` : 'View details'}
          </Text>
          <Text style={styles.totalAmount}>{formatINR(item.total_amount)}</Text>
        </View>
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity onPress={() => loadOrders(true)} style={styles.refreshBtn}>
          <MaterialIcons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052CC" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id || item.order_number)}
          renderItem={renderOrderItem}
          contentContainerStyle={orders.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} colors={['#0052CC']} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name="shopping-bag" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>Your placed orders will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#0052CC',
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  list: { padding: 16, paddingBottom: 24 },
  emptyList: { flexGrow: 1 },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center' },
  orderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: 15, fontWeight: '700', color: '#111' },
  orderDate: { fontSize: 12, color: '#666', marginTop: 3 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemCount: { fontSize: 13, color: '#666' },
  totalAmount: { fontSize: 16, fontWeight: '800', color: '#0052CC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
});

export default OrderListScreen;
