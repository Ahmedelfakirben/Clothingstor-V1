export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  base_price: number;
  available: boolean;
  created_at: string;
  updated_at: string;
  image_url: string;
  brand?: string;
  material?: string;
  gender?: string;
  season?: string;
  stock?: number;
}

export interface ProductSize {
  id: string;
  product_id: string;
  size_name: string;
  price_modifier: number;
  created_at: string;
}

export interface Order {
  id: string;
  employee_id: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  total: number;
  payment_method: 'cash' | 'card' | 'digital';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  size_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string;
  created_at: string;
}

export interface EmployeeProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'barista';
  phone: string | null;
  active: boolean;
  email?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}