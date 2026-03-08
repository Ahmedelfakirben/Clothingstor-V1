const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('order_items')
        .select('id, order_id, quantity, unit_price, purchase_price, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Recent Order Items:");
    console.log(JSON.stringify(data, null, 2));
    if (error) console.error("Error:", error);
}

check();
