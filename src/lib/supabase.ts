import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          description: string;
          created_at: string;
        };
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          description: string;
          base_price: number;
          image_url: string;
          available: boolean;
          created_at: string;
        };
      };
      product_sizes: {
        Row: {
          id: string;
          product_id: string;
          size_name: string;
          price_modifier: number;
          stock: number;
          created_at: string;
        };
      };
      customers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          loyalty_points: number;
          created_at: string;
        };
      };
      orders: {
        Row: {
          id: string;
          customer_id: string | null;
          employee_id: string;
          status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
          total: number;
          payment_method: 'cash' | 'card' | 'digital';
          notes: string;
          created_at: string;
          updated_at: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          size_id: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          notes: string;
          created_at: string;
        };
      };
      employee_profiles: {
        Row: {
          id: string;
          full_name: string;
          role: 'admin' | 'cashier' | 'barista';
          phone: string | null;
          active: boolean;
          email: string | null;
          deleted_at: string | null;
          created_at: string;
        };
      };
    };
  };
}
