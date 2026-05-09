import fs from 'fs';

const backup = JSON.parse(fs.readFileSync('cloud_backup.json', 'utf8'));
const perms = backup.role_permissions;

function escape(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return val;
}

let sql = 'TRUNCATE role_permissions CASCADE;\n';
const columns = Object.keys(perms[0]);

for (let i = 0; i < perms.length; i += 50) {
  const chunk = perms.slice(i, i + 50);
  sql += `INSERT INTO role_permissions (${columns.join(', ')}) VALUES \n`;
  sql += chunk.map(row => `(${columns.map(col => escape(row[col])).join(', ')})`).join(',\n') + ';\n';
}

fs.writeFileSync('clone_perms.sql', sql);
console.log('✅ clone_perms.sql generado.');
