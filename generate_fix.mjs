import fs from 'fs';

const backup = JSON.parse(fs.readFileSync('cloud_backup.json', 'utf8'));
let sql = '-- RESTAURACIÓN LIMPIEZA V1\n';

const TABLES = ['products', 'product_sizes', 'product_images', 'order_items', 'order_returns'];

function escape(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return val;
}

for (const table of TABLES) {
  const data = backup[table];
  if (!data || data.length === 0) continue;

  sql += `\n-- Tabla: ${table}\n`;
  let columns = Object.keys(data[0]);
  
  // MAPEO DE COLUMNAS: Aseguramos que use size_name
  const sqlColumns = columns.map(c => (table === 'product_sizes' && (c === 'size' || c === 'size_name')) ? 'size_name' : c);
  
  for (let i = 0; i < data.length; i += 50) {
    const chunk = data.slice(i, i + 50);
    sql += `INSERT INTO ${table} (${sqlColumns.join(', ')}) VALUES \n`;
    sql += chunk.map(row => `(${columns.map(col => escape(row[col])).join(', ')})`).join(',\n') + ';\n';
  }
}

fs.writeFileSync('fix_data.sql', sql);
console.log('✅ fix_data.sql generado.');
