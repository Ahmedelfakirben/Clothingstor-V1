import { useState } from 'react';
import { Server, Database, Download, Upload, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

interface ServerStatus {
  isOnline: boolean;
  latency: number;
  timestamp: string;
}

export function ServerManager() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingWithoutProducts, setImportingWithoutProducts] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleaningHistory, setCleaningHistory] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';

  // Verificar estado del servidor
  const checkServerStatus = async () => {
    setChecking(true);
    const startTime = Date.now();

    try {
      // Intentar hacer una consulta simple a Supabase
      const { error } = await supabase.from('company_settings').select('id').limit(1);
      const latency = Date.now() - startTime;

      if (error) throw error;

      setServerStatus({
        isOnline: true,
        latency,
        timestamp: new Date().toISOString(),
      });

      toast.success(t('Servidor en línea'));
    } catch (error) {
      console.error('Error checking server:', error);
      setServerStatus({
        isOnline: false,
        latency: 0,
        timestamp: new Date().toISOString(),
      });
      toast.error(t('Error al conectar con el servidor'));
    } finally {
      setChecking(false);
    }
  };

  // Exportar base de datos completa
  const exportDatabase = async () => {
    setExporting(true);

    try {
      toast.loading(t('Exportando base de datos...'));

      const backup: any = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: {},
      };

      // Lista de tablas a exportar
      const tables = [
        'company_settings',
        'employee_profiles',
        'products',
        'categories',
        'tables',
        'orders',
        'order_items',
        'cash_register_sessions',
        'cash_withdrawals',
        'suppliers',
        'expenses',
        'role_permissions',
      ];

      // Exportar cada tabla
      for (const table of tables) {
        try {
          const { data, error } = await supabase.from(table).select('*');
          if (error) throw error;
          backup.tables[table] = data;
          console.log(`✅ Exported ${table}: ${data?.length || 0} records`);
        } catch (err) {
          console.error(`❌ Error exporting ${table}:`, err);
          backup.tables[table] = [];
        }
      }

      // Crear archivo JSON y descargarlo
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success(t('Base de datos exportada correctamente'));
    } catch (error) {
      console.error('Error exporting database:', error);
      toast.dismiss();
      toast.error(t('Error al exportar la base de datos'));
    } finally {
      setExporting(false);
    }
  };

  // Importar base de datos desde archivo JSON
  const importDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm(t('¿Estás seguro de que deseas importar esta base de datos? Esta acción sobrescribirá los datos existentes.'))) {
      return;
    }

    setImporting(true);
    toast.loading(t('Importando base de datos...'));

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.tables || !backup.version) {
        throw new Error('Formato de backup inválido');
      }

      console.log(`📦 Importing backup from ${backup.timestamp}`);

      // Importar cada tabla (en orden para respetar relaciones)
      const importOrder = [
        'company_settings',
        'categories',
        'products',
        'employee_profiles',
        'tables',
        'suppliers',
        'role_permissions',
        'cash_register_sessions',
        'cash_withdrawals',
        'orders',
        'order_items',
        'expenses',
      ];

      for (const table of importOrder) {
        if (!backup.tables[table] || backup.tables[table].length === 0) {
          console.log(`⏭️  Skipping ${table} (no data)`);
          continue;
        }

        try {
          // Primero eliminar datos existentes (excepto si es employee_profiles con super_admin)
          if (table === 'employee_profiles') {
            // No eliminar super_admins
            const { error: deleteError } = await supabase
              .from(table)
              .delete()
              .neq('role', 'super_admin');
            if (deleteError) console.error(`Error deleting ${table}:`, deleteError);
          } else {
            const { error: deleteError } = await supabase
              .from(table)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
            if (deleteError) console.error(`Error deleting ${table}:`, deleteError);
          }

          // Insertar nuevos datos
          const { error: insertError } = await supabase.from(table).insert(backup.tables[table]);
          if (insertError) throw insertError;

          console.log(`✅ Imported ${table}: ${backup.tables[table].length} records`);
        } catch (err) {
          console.error(`❌ Error importing ${table}:`, err);
        }
      }

      toast.dismiss();
      toast.success(t('Base de datos importada correctamente'));

      // Recargar página después de 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error importing database:', error);
      toast.dismiss();
      toast.error(t('Error al importar la base de datos'));
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  // Importar base de datos SIN categorías y productos
  const importDatabaseWithoutProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm(t('¿Estás seguro de que deseas importar esta base de datos SIN categorías y productos? Los datos existentes se sobrescribirán excepto categorías y productos.'))) {
      return;
    }

    setImportingWithoutProducts(true);
    toast.loading(t('Importando base de datos sin productos...'));

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.tables || !backup.version) {
        throw new Error('Formato de backup inválido');
      }

      // Orden de importación (SIN categorías y productos)
      const importOrder = [
        'company_settings',
        'employee_profiles',
        'tables',
        'suppliers',
        'role_permissions',
        'cash_register_sessions',
        'cash_withdrawals',
        'orders',
        'order_items',
        'expenses',
      ];

      for (const table of importOrder) {
        if (!backup.tables[table] || backup.tables[table].length === 0) {
          continue;
        }

        try {
          // Eliminar datos existentes (preservar super_admin para employee_profiles)
          if (table === 'employee_profiles') {
            const { error: deleteError } = await supabase
              .from(table)
              .delete()
              .neq('role', 'super_admin');
            if (deleteError) console.error(`Error deleting ${table}:`, deleteError);
          } else {
            const { error: deleteError } = await supabase
              .from(table)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
            if (deleteError) console.error(`Error deleting ${table}:`, deleteError);
          }

          // Insertar nuevos datos
          const { error: insertError } = await supabase.from(table).insert(backup.tables[table]);
          if (insertError) throw insertError;

          console.log(`✅ Imported ${table} (without products/categories)`);
        } catch (err) {
          console.error(`❌ Error importing ${table}:`, err);
        }
      }

      toast.dismiss();
      toast.success(t('Base de datos importada correctamente (sin productos/categorías)'));

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error importing database without products:', error);
      toast.dismiss();
      toast.error(t('Error al importar la base de datos'));
    } finally {
      setImportingWithoutProducts(false);
      event.target.value = '';
    }
  };

  // Limpiar SOLO historial (mantener categorías, productos y super_admin)
  const cleanHistoryOnly = async () => {
    if (!window.confirm(t('⚠️ ADVERTENCIA: Esta acción eliminará el historial (pedidos, empleados no super_admin, sesiones de caja) pero MANTENDRÁ las categorías y productos. ¿Continuar?'))) {
      return;
    }

    if (!window.confirm(t('Esta acción es IRREVERSIBLE. ¿Confirmas que deseas limpiar solo el historial?'))) {
      return;
    }

    setCleaningHistory(true);
    toast.loading(t('Limpiando historial...'));

    try {
      // Limpiar solo tablas de historial (NO productos ni categorías)
      const cleanupOrder = [
        'order_items',
        'orders',
        'expenses',
        'cash_withdrawals',
        'cash_register_sessions',
        'tables',
      ];

      // Primero limpiamos las tablas normales (todas las filas)
      for (const table of cleanupOrder) {
        try {
          // Obtener todos los IDs primero
          const { data: allRows, error: fetchError } = await supabase
            .from(table)
            .select('id');

          if (fetchError) {
            console.error(`❌ Error fetching ${table}:`, fetchError);
            continue;
          }

          if (allRows && allRows.length > 0) {
            const ids = allRows.map(row => row.id);

            // Eliminar por lotes de 1000
            for (let i = 0; i < ids.length; i += 1000) {
              const batch = ids.slice(i, i + 1000);
              const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .in('id', batch);

              if (deleteError) {
                console.error(`❌ Error deleting batch from ${table}:`, deleteError);
              }
            }

            console.log(`✅ Cleaned ${table}: ${ids.length} rows deleted`);
          } else {
            console.log(`✅ ${table} already empty`);
          }
        } catch (err) {
          console.error(`❌ Error cleaning ${table}:`, err);
        }
      }

      // Limpiar employee_profiles (EXCEPTO super_admin)
      try {
        const { data: nonSuperAdmins, error: fetchError } = await supabase
          .from('employee_profiles')
          .select('id')
          .neq('role', 'super_admin');

        if (fetchError) {
          console.error('❌ Error fetching employee_profiles:', fetchError);
        } else if (nonSuperAdmins && nonSuperAdmins.length > 0) {
          const ids = nonSuperAdmins.map(row => row.id);

          const { error: deleteError } = await supabase
            .from('employee_profiles')
            .delete()
            .in('id', ids);

          if (deleteError) {
            console.error('❌ Error deleting employee_profiles:', deleteError);
          } else {
            console.log(`✅ Cleaned employee_profiles: ${ids.length} non-super_admin users deleted`);
          }
        } else {
          console.log('✅ No non-super_admin employees to delete');
        }
      } catch (err) {
        console.error('❌ Error cleaning employee_profiles:', err);
      }

      toast.dismiss();
      toast.success(t('Historial limpiado correctamente (productos y categorías preservados)'));

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error cleaning history:', error);
      toast.dismiss();
      toast.error(t('Error al limpiar el historial'));
    } finally {
      setCleaningHistory(false);
    }
  };

  // Limpiar base de datos COMPLETA (mantener super_admin, config empresa, categorías, proveedores)
  const cleanDatabase = async () => {
    if (!window.confirm(t('⚠️ ADVERTENCIA: Esta acción eliminará TODOS los datos del historial (pedidos, empleados no super_admin, etc.). ¿Estás completamente seguro?'))) {
      return;
    }

    if (!window.confirm(t('Esta acción es IRREVERSIBLE. ¿Continuar de todos modos?'))) {
      return;
    }

    setCleaning(true);
    toast.loading(t('Limpiando base de datos...'));

    try {
      // Limpiar tablas en orden (respetando foreign keys)
      const cleanupOrder = [
        'order_items',
        'orders',
        'expenses',
        'cash_withdrawals',
        'cash_register_sessions',
        'products',
        'tables',
      ];

      // Limpiar tablas normales (todas las filas)
      for (const table of cleanupOrder) {
        try {
          // Obtener todos los IDs primero
          const { data: allRows, error: fetchError } = await supabase
            .from(table)
            .select('id');

          if (fetchError) {
            console.error(`❌ Error fetching ${table}:`, fetchError);
            continue;
          }

          if (allRows && allRows.length > 0) {
            const ids = allRows.map(row => row.id);

            // Eliminar por lotes de 1000
            for (let i = 0; i < ids.length; i += 1000) {
              const batch = ids.slice(i, i + 1000);
              const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .in('id', batch);

              if (deleteError) {
                console.error(`❌ Error deleting batch from ${table}:`, deleteError);
              }
            }

            console.log(`✅ Cleaned ${table}: ${ids.length} rows deleted`);
          } else {
            console.log(`✅ ${table} already empty`);
          }
        } catch (err) {
          console.error(`❌ Error cleaning ${table}:`, err);
        }
      }

      // Limpiar employee_profiles (EXCEPTO super_admin)
      try {
        const { data: nonSuperAdmins, error: fetchError } = await supabase
          .from('employee_profiles')
          .select('id')
          .neq('role', 'super_admin');

        if (fetchError) {
          console.error('❌ Error fetching employee_profiles:', fetchError);
        } else if (nonSuperAdmins && nonSuperAdmins.length > 0) {
          const ids = nonSuperAdmins.map(row => row.id);

          const { error: deleteError } = await supabase
            .from('employee_profiles')
            .delete()
            .in('id', ids);

          if (deleteError) {
            console.error('❌ Error deleting employee_profiles:', deleteError);
          } else {
            console.log(`✅ Cleaned employee_profiles: ${ids.length} non-super_admin users deleted`);
          }
        } else {
          console.log('✅ No non-super_admin employees to delete');
        }
      } catch (err) {
        console.error('❌ Error cleaning employee_profiles:', err);
      }

      toast.dismiss();
      toast.success(t('Base de datos limpiada correctamente'));

      // Recargar página después de 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error cleaning database:', error);
      toast.dismiss();
      toast.error(t('Error al limpiar la base de datos'));
    } finally {
      setCleaning(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('Acceso Denegado')}</h2>
          <p className="text-gray-600">{t('Solo los Super Administradores pueden acceder a esta sección.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Server className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('Gestión del Servidor')}</h2>
            <p className="text-sm text-gray-600">{t('Administra el estado y los datos del servidor')}</p>
          </div>
        </div>
      </div>

      {/* Advertencia de Seguridad */}
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-semibold mb-1">⚠️ {t('Zona de Super Administrador')}</p>
            <p>{t('Las operaciones en esta sección son críticas y pueden afectar toda la base de datos. Procede con precaución.')}</p>
          </div>
        </div>
      </div>

      {/* Estado del Servidor */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">{t('Estado del Servidor')}</h3>
          </div>
          <button
            onClick={checkServerStatus}
            disabled={checking}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {checking ? (
              <>
                <LoadingSpinner size="sm" light />
                {t('Verificando...')}
              </>
            ) : (
              <>
                <Server className="w-4 h-4" />
                {t('Verificar Estado')}
              </>
            )}
          </button>
        </div>

        {serverStatus && (
          <div className={`p-4 rounded-lg border-2 ${serverStatus.isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              {serverStatus.isOnline ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
              <span className={`text-lg font-semibold ${serverStatus.isOnline ? 'text-green-900' : 'text-red-900'}`}>
                {serverStatus.isOnline ? t('Servidor En Línea') : t('Servidor Fuera de Línea')}
              </span>
            </div>
            {serverStatus.isOnline && (
              <div className="text-sm text-green-700 ml-9">
                <p>{t('Latencia')}: {serverStatus.latency}ms</p>
                <p className="text-xs text-green-600 mt-1">{t('Última verificación')}: {new Date(serverStatus.timestamp).toLocaleString('es-ES')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backup y Restauración */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('Backup y Restauración')}</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t('Exporta una copia completa de la base de datos o importa un backup previo.')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Exportar Backup */}
          <button
            onClick={exportDatabase}
            disabled={exporting}
            className="flex items-center gap-3 p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-900">{t('Exportar Backup')}</p>
              <p className="text-xs text-gray-600">{t('Descargar base de datos completa en JSON')}</p>
            </div>
            {exporting && <LoadingSpinner size="sm" />}
          </button>

          {/* Importar Backup Completo */}
          <label className="flex items-center gap-3 p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-900">{t('Importar Backup')}</p>
              <p className="text-xs text-gray-600">{t('Cargar backup desde archivo JSON')}</p>
            </div>
            {importing && <LoadingSpinner size="sm" />}
            <input
              type="file"
              accept=".json"
              onChange={importDatabase}
              disabled={importing}
              className="hidden"
            />
          </label>

          {/* Importar Sin Productos */}
          <label className="flex items-center gap-3 p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Upload className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-900">{t('Importar Sin Productos')}</p>
              <p className="text-xs text-gray-600">{t('Restaurar sin sobrescribir categorías/productos')}</p>
            </div>
            {importingWithoutProducts && <LoadingSpinner size="sm" />}
            <input
              type="file"
              accept=".json"
              onChange={importDatabaseWithoutProducts}
              disabled={importingWithoutProducts}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Limpieza de Base de Datos */}
      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('Limpieza de Base de Datos')}</h3>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ {t('Advertencia')}:</strong> {t('Esta acción eliminará PERMANENTEMENTE todos los datos históricos: pedidos, empleados (excepto super_admin), sesiones de caja, etc.')}
          </p>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t('Se mantendrán')}:
        </p>
        <ul className="text-sm text-gray-600 mb-4 ml-4 list-disc">
          <li>{t('Usuarios Super Administrador')}</li>
          <li>{t('Configuración de la empresa')}</li>
          <li>{t('Categorías de productos')}</li>
          <li>{t('Proveedores')}</li>
          <li>{t('Permisos de roles')}</li>
        </ul>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Limpiar Solo Historial */}
          <button
            onClick={cleanHistoryOnly}
            disabled={cleaningHistory}
            className="flex items-center justify-center gap-3 p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cleaningHistory ? (
              <>
                <LoadingSpinner size="sm" light />
                {t('Limpiando...')}
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                {t('Limpiar Solo Historial')}
              </>
            )}
          </button>

          {/* Limpiar Todo */}
          <button
            onClick={cleanDatabase}
            disabled={cleaning}
            className="flex items-center justify-center gap-3 p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cleaning ? (
              <>
                <LoadingSpinner size="sm" light />
                {t('Limpiando...')}
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                {t('Limpiar Todo Completo')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
