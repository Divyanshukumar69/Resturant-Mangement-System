export interface OrderItem {
  id?: number;
  order_id?: number;
  menu_item_id?: number;
  quantity: number;
  price_at_time: number;
  name_at_time: string;
}

export interface Order {
  id: number;
  restaurant_id: number;
  table_id: number;
  customer_nickname: string;
  status: string;
  total_amount: number;
  created_at: string;
  items: OrderItem[];
  table_name?: string;
  discount_applied?: number;
  final_amount?: number;
}

export interface Table {
  id: number;
  name: string;
  status: string;
  restaurant_id: number;
}

export interface MenuItem {
  id: number;
  name: string;
  category_name?: string;
  price: number;
  is_available: number;
  is_special: number;
  description?: string;
  image_url?: string;
  rating?: number;
  category_id?: number;
}

export interface Discount {
  id: number;
  code: string;
  percentage: number;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  items: MenuItem[];
}
