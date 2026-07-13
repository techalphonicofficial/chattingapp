export const SHOP_API_BASE = 'https://bulge-payroll-dragonfly.ngrok-free.dev';

export const shopHeaders = (token: string) => ({
  accept: '*/*',
  Authorization: `Bearer ${token}`,
  'ngrok-skip-browser-warning': 'true',
});
