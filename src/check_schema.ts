import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const { data: product, error: pError } = await supabase.from('products').select('*').limit(1);
  const { data: category, error: cError } = await supabase.from('categories').select('*').limit(1);

  if (pError) console.error('Error fetching product schema:', pError.message);
  if (cError) console.error('Error fetching category schema:', cError.message);

  console.log('Product columns:', product && product.length > 0 ? Object.keys(product[0]) : 'None or empty table');
  console.log('Category columns:', category && category.length > 0 ? Object.keys(category[0]) : 'None or empty table');
}

checkColumns();
