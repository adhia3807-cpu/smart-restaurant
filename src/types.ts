export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string; // slug of category
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  image: string; // URL or placeholder
  description: string;
  cookingTime: number; // in minutes
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  specialInstructions?: string;
  isReady?: boolean; // Used by Worker App
  status?: 'Waiting' | 'Cooking' | 'Ready';
}

export type OrderStatus = 'Waiting' | 'Cooking' | 'Ready' | 'Delivered';

export interface Order {
  id: string;
  orderNumber: string; // e.g. ORD-1001
  table: number;
  time: string; // Date string or time string
  items: OrderItem[];
  status: OrderStatus;
  totalPrice: number;
  specialInstructions?: string;
  date?: string;
}

export interface MQTTMessage {
  table: number;
  status: 'READY' | 'RESET';
  timestamp: string;
}

export interface AnalyticsSummary {
  dailySales: number;
  monthlySales: number;
  totalOrders: number;
  popularItems: { name: string; count: number; sales: number; isVeg: boolean }[];
  salesTrend: { date: string; amount: number }[];
}
