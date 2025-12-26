import { useState, useEffect, useRef } from 'react';
import { Database, Download, Upload, HardDrive, AlertCircle, CheckCircle2, Clock, Trash2, RefreshCw, Settings, AlertTriangle, FileUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AutomatedBackupConfig } from './AutomatedBackupConfig';
import { LoadingSpinner } from './LoadingSpinner';

interface BackupHistory {
  id: string;
  created_at: string;
  created_by: string;
  backup_type: 'manual' | 'automatic';
  size_mb: number;
  tables_included: string[];
  status: 'completed' | 'failed';
}

export function BackupManager() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'manual' | 'automated'>('manual');
  const [loading, setLoading] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lista de tablas actualizada y ordenada por dependencias para restauración
  // ORDEN CRÍTICO: Las tablas independientes primero, luego las dependientes
  const allTables = [
    // 1. Configuración e Independientes
    { id: 'company_settings', name: t('Configuración de Empresa'), essential: true },
    { id: 'app_currency_settings', name: t('Configuración de Moneda'), essential: true },
    { id: 'backup_config', name: t('Configuración de Backups'), essential: true },
    { id: 'role_permissions', name: t('Permisos de Roles'), essential: true },
    { id: 'tables', name: t('Mesas'), essential: true },
    { id: 'available_currencies', name: t('Catálogo de Divisas'), essential: true },

    // 2. Catálogos Base
    { id: 'categories', name: t('Categorías'), essential: true },
    { id: 'suppliers', name: t('Proveedores'), essential: false },

    // 3. Entidades Principales
    // Nota: employees y customers dependen de auth.users idealmente, pero aquí son tablas públicas
    { id: 'employee_profiles', name: t('Perfiles de Empleados'), essential: true },
    { id: 'customers', name: t('Clientes'), essential: false },

    // 4. Productos y Stock (Dependen de Categorías)
    { id: 'products', name: t('Productos'), essential: true },
    { id: 'product_sizes', name: t('Tallas y Stock'), essential: true },

    // 5. Operaciones (Dependen de todo lo anterior)
    { id: 'cash_register_sessions', name: t('Sesiones de Caja'), essential: true },
    { id: 'cash_withdrawals', name: t('Retiros de Caja'), essential: true },

    // 6. Órdenes y Transacciones
    { id: 'orders', name: t('Órdenes'), essential: true },
    { id: 'order_items', name: t('Items de Órdenes'), essential: true },
    { id: 'order_history', name: t('Historial de Órdenes'), essential: false },

    // 7. Historial y Metadata
    { id: 'deleted_products', name: t('Productos Eliminados'), essential: false },
    { id: 'deleted_orders', name: t('Órdenes Eliminadas'), essential: false },
    { id: 'backup_history', name: t('Historial de Backups'), essential: false },

    // 8. Otros
    { id: 'expenses', name: t('Gastos'), essential: false },
  ];

  const [selectedTables, setSelectedTables] = useState<string[]>(allTables.map(t => t.id));

  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    if (isSuperAdmin) {
      loadBackupHistory();
    }
  }, [isSuperAdmin]);

  const loadBackupHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('backup_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setBackupHistory(data || []);
    } catch (error: any) {
      console.error('Error loading backup history:', error);
      // Si la tabla no existe, simplemente no mostramos historial
      setBackupHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!isSuperAdmin) {
      toast.error(t('Solo el Super Administrador puede crear backups'));
      return;
    }

    if (selectedTables.length === 0) {
      toast.error(t('Selecciona al menos una tabla para el backup'));
      return;
    }

    setLoading(true);
    try {
      const backupData: any = {
        timestamp: new Date().toISOString(),
        version: '1.1', // Incremento de versión por nuevas tablas
        tables: {},
        metadata: {
          created_by: profile?.full_name,
          created_at: new Date().toISOString(),
          tables_count: selectedTables.length
        }
      };

      let totalRecords = 0;

      // Exportar datos de cada tabla seleccionada
      for (const table of selectedTables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*');

          if (error) {
            console.error(`Error al exportar tabla ${table}:`, error);
            // Si la tabla no existe (ej. app_settings antigua), no fallar todo el backup
            continue;
          }

          backupData.tables[table] = data || [];
          totalRecords += (data || []).length;
        } catch (err) {
          console.error(`Error processing table ${table}:`, err);
        }
      }

      // Calcular tamaño aproximado
      const jsonString = JSON.stringify(backupData, null, 2);
      const sizeInBytes = new Blob([jsonString]).size;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

      // Crear archivo de descarga
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-clothing-store-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Guardar registro en historial
      try {
        await supabase.from('backup_history').insert({
          created_by: profile?.id,
          backup_type: 'manual',
          size_mb: parseFloat(sizeInMB),
          tables_included: selectedTables,
          status: 'completed'
        });
      } catch (err) {
        console.log('Skipping history save');
      }

      toast.success(t(`Backup creado exitosamente. ${totalRecords} registros exportados (${sizeInMB} MB)`));
      loadBackupHistory();
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast.error(t(`Error al crear backup: ${error.message}`));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm(t('¿Estás seguro de que deseas restaurar este backup? Esto podría sobrescribir datos existentes.'))) {
      event.target.value = ''; // Reset input
      return;
    }

    setLoading(true);
    const toastId = toast.loading(t('Restaurando base de datos... Por favor espere.'));

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.tables) {
        throw new Error(t('Formato de archivo de backup inválido'));
      }

      // Llamar a la función SQL que hace el restore con SECURITY DEFINER
      const { data, error } = await supabase.rpc('restore_backup_from_app', {
        backup_data: backupData
      });

      if (error) {
        console.error('Error en función restore:', error);
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      console.log('✅ Restore completado:', data);

      if (data.failed_tables && data.failed_tables.length > 0) {
        toast.error(
          `${t('Restauración parcial.')} ${data.total_inserted} ${t('registros insertados.')} ${t('Errores:')} ${data.failed_tables.join(', ')}`,
          { id: toastId, duration: 10000 }
        );
      } else {
        toast.success(
          `${t('Restauración completada.')} ${data.total_inserted} ${t('registros procesados.')}`,
          { id: toastId }
        );
      }
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      toast.error(`${t('Fallo al restaurar backup:')} ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetDatabase = async () => {
    const confirmation = window.prompt(t('PELIGRO: Esta acción eliminará TODOS los datos (Productos, Ventas, Clientes). Solo se conservarán los usuarios Administradores. Escriba "ELIMINAR" para confirmar.'));

    if (confirmation !== 'ELIMINAR') {
      if (confirmation) toast.error(t('Texto de confirmación incorrecto. Operación cancelada.'));
      return;
    }

    setLoading(true);
    const toastId = toast.loading(t('Reseteando base de datos...'));

    try {
      // Llamar a la función SQL que hace el reset con SECURITY DEFINER
      const { data, error } = await supabase.rpc('reset_database_from_app');

      if (error) {
        console.error('Error en función reset:', error);
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      console.log('✅ Reset completado:', data);

      toast.success(
        `${t('Base de datos reseteada correctamente.')} ${t('Órdenes:')} ${data.orders_remaining}, ${t('Productos:')} ${data.products_remaining}, ${t('Empleados:')} ${data.employees_remaining}`,
        { id: toastId }
      );

      // Recargar página para limpiar estados locales
      setTimeout(() => window.location.reload(), 2000);

    } catch (error: any) {
      console.error('Error resetting database:', error);
      toast.error(`${t('Error al resetear:')} ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev =>
      prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
    );
  };

  const selectAllTables = () => setSelectedTables(allTables.map(t => t.id));
  const selectEssentialTables = () => setSelectedTables(allTables.filter(t => t.essential).map(t => t.id));
  const deselectAllTables = () => setSelectedTables([]);

  if (!isSuperAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">{t('Acceso Restringido')}</h3>
          <p className="text-yellow-700">{t('Solo el Super Administrador puede acceder a la gestión de backups.')}</p>
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
            <Database className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Backups')}</h2>
            <p className="text-sm text-gray-600">{t('Crea, restaura y administra copias de seguridad')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'manual'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              {t('Backup Manual')}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('automated')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'automated'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('Backup Automático')}
            </div>
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'automated' ? (
        <AutomatedBackupConfig />
      ) : (
        <div className="space-y-6">

          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">{t('Información Importante')}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('Los backups se descargan en JSON. Guárdalos en un lugar seguro.')}</li>
                  <li>{t('La restauración sobrescribirá los datos existentes con el mismo ID.')}</li>
                  <li>{t('El reseteo de base de datos es IRREVERSIBLE, utilízalo con precaución.')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Selección de Tablas */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">{t('Seleccionar Tablas')}</h3>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAllTables} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">{t('Todas')}</button>
                <button onClick={selectEssentialTables} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">{t('Esenciales')}</button>
                <button onClick={deselectAllTables} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">{t('Ninguna')}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allTables.map(table => (
                <label key={table.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedTables.includes(table.id) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedTables.includes(table.id)} onChange={() => handleTableToggle(table.id)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${selectedTables.includes(table.id) ? 'text-indigo-900' : 'text-gray-900'}`}>{table.name}</p>
                    {table.essential && <span className="text-xs text-green-600 font-medium">{t('Esencial')}</span>}
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <strong>{selectedTables.length}</strong> {t('de')} <strong>{allTables.length}</strong> {t('tablas seleccionadas')}
            </div>
          </div>

          {/* Acciones Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crear Backup */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Crear Backup')}</h3>
              <p className="text-sm text-gray-600 mb-4">{t('Descarga una copia completa de tu base de datos.')}</p>
              <button
                onClick={handleCreateBackup}
                disabled={loading || selectedTables.length === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {loading ? <LoadingSpinner size="sm" light /> : <Download className="w-5 h-5" />}
                {loading ? t('Creando...') : t('Descargar Backup')}
              </button>
            </div>

            {/* Restaurar Backup */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Restaurar Backup')}</h3>
              <p className="text-sm text-gray-600 mb-4">{t('Carga un archivo JSON para restaurar datos.')}</p>

              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleRestoreBackup}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {loading ? <LoadingSpinner size="sm" /> : <Upload className="w-5 h-5" />}
                {loading ? t('Restaurando...') : t('Cargar Archivo de Respaldo')}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">{t('Zona de Peligro')}</h3>
                <p className="text-sm text-red-700 mb-4">
                  {t('Estas acciones son destructivas e irreversibles. Asegúrate de tener un backup reciente.')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleResetDatabase}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('Resetear Base de Datos (Conservar Admins)')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Historial */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">{t('Historial de Backups')}</h3>
            </div>
            {loadingHistory ? (
              <div className="text-center py-8"><LoadingSpinner size="lg" /></div>
            ) : backupHistory.length === 0 ? (
              <p className="text-center py-8 text-gray-500">{t('No hay backups registrados aún')}</p>
            ) : (
              <div className="space-y-3">
                {backupHistory.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      {backup.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                      <div>
                        <p className="font-medium text-gray-900">{new Date(backup.created_at).toLocaleString('es-ES')}</p>
                        <p className="text-sm text-gray-600">{backup.backup_type} • {backup.size_mb.toFixed(2)} MB</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${backup.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {backup.status === 'completed' ? t('Completado') : t('Fallido')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
