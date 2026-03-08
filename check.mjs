import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: prods, error: pErr } = await supabase
        .from('products')
        .select('name, base_price, purchase_price')
        .limit(3);

    console.log("Products:");
    console.log(JSON.stringify(prods, null, 2));

    const { data: items, error: iErr } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price, purchase_price')
        .order('created_at', { ascending: false })
        .limit(3);

    console.log("Order Items:");
    console.log(JSON.stringify(items, null, 2));
}

check();
