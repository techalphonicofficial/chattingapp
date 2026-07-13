import { SHOP_API_BASE, shopHeaders } from '../config/shopApi';

export interface OrderItem {
  id: number;
  order_id: number;
  quantity: number;
  unit_price: string;
  status: string;
  variant?: {
    image?: string | null;
    sku?: string;
    product?: {
      name?: string;
      galleries?: { image_url?: string; sort_order?: number }[];
    };
  };
}

export interface ShippingAddress {
  full_name?: string;
  phone?: string;
  street?: string;
  city?: string;
  postal_code?: string;
  address_type?: string;
}

export interface Order {
  id: number;
  order_number: string;
  status: string;
  total_amount: string;
  payment_method?: string;
  discount_amount?: string;
  coupon_code?: string | null;
  created_at: string;
  items?: OrderItem[];
  shipping_address?: ShippingAddress;
}

interface ApiResponse<T> {
  status?: boolean;
  message?: string;
  data?: T;
}

export const getProductImage = (item: OrderItem): string | null => {
  const images = getProductImages(item);
  return images[0] || null;
};

export const getProductImages = (item: OrderItem): string[] => {
  const urls: string[] = [];

  const galleries = [...(item.variant?.product?.galleries || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  galleries.forEach((gallery) => {
    const url = gallery.image_url?.trim();
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  });

  const variantImage = item.variant?.image?.trim();
  if (variantImage && !urls.includes(variantImage)) {
    urls.unshift(variantImage);
  }

  return urls;
};

export const parseOrdersList = (json: any): Order[] => {
  if (Array.isArray(json?.data?.orders)) return json.data.orders;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.orders)) return json.orders;
  return [];
};

export async function fetchCustomerOrders(token: string): Promise<Order[]> {
  const response = await fetch(`${SHOP_API_BASE}/customer/orders`, {
    method: 'GET',
    headers: shopHeaders(token),
  });
  const json = await response.json();
  if (!response.ok || json.status === false) {
    throw new Error(json.message || 'Failed to fetch orders');
  }
  return parseOrdersList(json);
}

export async function fetchOrderDetails(token: string, orderNumber: string): Promise<Order> {
  const response = await fetch(`${SHOP_API_BASE}/customer/orders/${orderNumber}`, {
    method: 'GET',
    headers: shopHeaders(token),
  });
  const json: ApiResponse<{ order: Order }> = await response.json();
  if (!response.ok || json.status === false || !json.data?.order) {
    throw new Error(json.message || 'Failed to fetch order details');
  }
  return json.data.order;
}

export const formatINR = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isNaN(num) ? 0 : num);
};

export const formatOrderDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const getStatusStyle = (status: string) => {
  const key = status?.toLowerCase() || '';
  if (key.includes('deliver') || key.includes('complete')) {
    return { bg: '#DCFCE7', text: '#166534' };
  }
  if (key.includes('cancel')) {
    return { bg: '#FEE2E2', text: '#991B1B' };
  }
  if (key.includes('ship') || key.includes('process')) {
    return { bg: '#DBEAFE', text: '#1E40AF' };
  }
  return { bg: '#FEF3C7', text: '#92400E' };
};
