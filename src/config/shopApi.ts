export const SHOP_API_BASE = 'https://yber.in/api';

export const shopHeaders = (token: string) => ({
  accept: '*/*',
  Authorization: `Bearer ${token}`,
  'ngrok-skip-browser-warning': 'true',
});
