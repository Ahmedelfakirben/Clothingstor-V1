import fs from 'fs';

const backup = JSON.parse(fs.readFileSync('cloud_backup.json', 'utf8'));
let sql = '-- PARCHE DE SINCRONIZACIÓN RECIENTE\n';
sql += "SET session_replication_role = 'replica';\n";

const TABLES = ['orders', 'order_items', 'order_history', 'order_returns', 'cash_register_sessions'];

function escape(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return val;
}

// Filtramos solo los 2 pedidos de hoy
const targetOrderIds = ['8e2d4ab1-5df2-41be-9670-169e93322d64', 'c1980da2-e089-44e3-b1bf-1729ee9f68a2'];

for (const table of TABLES) {
  let data = backup[table];
  if (!data || data.length === 0) continue;

  // Filtrar datos para que solo sean de esos pedidos
  if (table === 'orders') {
    data = data.filter(o => targetOrderIds.includes(o.id));
  } else if (table === 'order_items' || table === 'order_history') {
    data = data.filter(o => targetOrderIds.includes(o.order_id));
  } else if (table === 'order_returns') {
    const itemIds = backup.order_items.filter(i => targetOrderIds.includes(i.order_id)).map(i => i.id);
    data = data.filter(r => itemIds.includes(r.order_item_id));
  } else if (table === 'cash_register_sessions') {
    const employeeIds = backup.orders.filter(o => targetOrderIds.includes(o.id)).map(o => o.employee_id);
    data = data.filter(s => employeeIds.includes(s.employee_id) && s.opened_at.startsWith('2026-05-08'));
  }

  if (data.length === 0) continue;

  sql += `\n-- Insertando en ${table} (${data.length} registros)\n`;
  const columns = Object.keys(data[0]);
  
  // Usamos ON CONFLICT DO NOTHING para no tener errores de duplicados si alguno ya estuviera
  sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES \n`;
  sql += data.map(row => `(${columns.map(col => escape(row[col])).join(', ')})`).join(',\n');
  sql += ` ON CONFLICT (id) DO NOTHING;\n`;
}

sql += "\nSET session_replication_role = 'origin';\n";
fs.writeFileSync('sync_orders.sql', sql);
console.log('✅ sync_orders.sql generado.');
