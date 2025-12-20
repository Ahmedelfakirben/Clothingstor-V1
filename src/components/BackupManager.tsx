import { useState, useEffect } from 'react';
import { Database, Download, Upload, HardDrive, AlertCircle, CheckCircle2, Clock, Trash2, RefreshCw, Settings } from 'lucide-react';
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
  const [selectedTables, setSelectedTables] = useState<string[]>([
    'products',
    'categories',
    'orders',
    'order_items',
    'employee_profiles',
    'customers',
    'suppliers',
    'expenses',
    'cash_register_sessions',
    'employee_time_entries',
    'role_permissions',
    'company_settings',
    'app_settings',
    'tables',
    'servers'
  ]);

  const isSuperAdmin = profile?.role === 'super_admin';

  const allTables = [
    { id: 'products', name: t('Productos'), essential: true },
    { id: 'categories', name: t('Categorías'), essential: true },
    { id: 'orders', name: t('Órdenes'), essential: true },
    { id: 'order_items', name: t('Items de Órdenes'), essential: true },
    { id: 'employee_profiles', name: t('Perfiles de Empleados'), essential: true },
    { id: 'customers', name: t('Clientes'), essential: false },
    { id: 'suppliers', name: t('Proveedores'), essential: false },
    { id: 'expenses', name: t('Gastos'), essential: false },
    { id: 'cash_register_sessions', name: t('Sesiones de Caja'), essential: true },
    { id: 'employee_time_entries', name: t('Registro de Tiempo'), essential: false },
    { id: 'role_permissions', name: t('Permisos de Roles'), essential: true },
    { id: 'company_settings', name: t('Configuración de Empresa'), essential: true },
    { id: 'app_settings', name: t('Configuración de App'), essential: true },
    { id: 'tables', name: t('Mesas'), essential: true },
    { id: 'servers', name: t('Servidores'), essential: false }
  ];

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
        version: '1.0',
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
      link.download = `backup-coffe-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
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
        console.log('Backup history table not available, skipping history save');
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

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev =>
      prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
    );
  };

  const selectAllTables = () => {
    setSelectedTables(allTables.map(t => t.id));
  };

  const selectEssentialTables = () => {
    setSelectedTables(allTables.filter(t => t.essential).map(t => t.id));
  };

  const deselectAllTables = () => {
    setSelectedTables([]);
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            {t('Acceso Restringido')}
          </h3>
          <p className="text-yellow-700">
            {t('Solo el Super Administrador puede acceder a la gestión de backups.')}
          </p>
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
            <p className="text-sm text-gray-600">{t('Crea y administra copias de seguridad de tu base de datos')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'manual'
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
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'automated'
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
        <div>

      {/* Info Alert */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">{t('Información Importante')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('Los backups se descargan en formato JSON en tu dispositivo')}</li>
              <li>{t('Guarda los backups en un lugar seguro fuera del servidor')}</li>
              <li>{t('Se recomienda realizar backups periódicamente (diario/semanal)')}</li>
              <li>{t('Los backups incluyen toda la información de las tablas seleccionadas')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Selección de Tablas */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">{t('Seleccionar Tablas')}</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAllTables}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              {t('Todas')}
            </button>
            <button
              onClick={selectEssentialTables}
              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              {t('Esenciales')}
            </button>
            <button
              onClick={deselectAllTables}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {t('Ninguna')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allTables.map(table => (
            <label
              key={table.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedTables.includes(table.id)
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTables.includes(table.id)}
                onChange={() => handleTableToggle(table.id)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  selectedTables.includes(table.id) ? 'text-indigo-900' : 'text-gray-900'
                }`}>
                  {table.name}
                </p>
                {table.essential && (
                  <span className="text-xs text-green-600 font-medium">{t('Esencial')}</span>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>{selectedTables.length}</strong> {t('de')} <strong>{allTables.length}</strong> {t('tablas seleccionadas')}
          </p>
        </div>
      </div>

      {/* Acción de Backup */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Crear Backup')}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {t('El backup se descargará como archivo JSON en tu dispositivo. Guárdalo en un lugar seguro.')}
        </p>

        <button
          onClick={handleCreateBackup}
          disabled={loading || selectedTables.length === 0}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" light />
              {t('Creando Backup...')}
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              {t('Descargar Backup Ahora')}
            </>
          )}
        </button>
      </div>

      {/* Historial de Backups */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('Historial de Backups')}</h3>
        </div>

        {loadingHistory ? (
          <div className="text-center py-8">
            <div className="mb-2 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
            <p className="text-sm text-gray-500">{t('Cargando historial...')}</p>
          </div>
        ) : backupHistory.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{t('No hay backups registrados aún')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('Los backups creados aparecerán aquí')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {backupHistory.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {backup.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(backup.created_at).toLocaleString('es-ES')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {backup.backup_type === 'manual' ? t('Manual') : t('Automático')} • {backup.size_mb.toFixed(2)} MB • {backup.tables_included.length} {t('tablas')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    backup.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {backup.status === 'completed' ? t('Completado') : t('Fallido')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recomendaciones */}
      <div className="mt-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-purple-900 mb-3">{t('Recomendaciones')}</h3>
        <ul className="space-y-2 text-sm text-purple-800">
          <li className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span>{t('Realiza backups antes de actualizar la aplicación o hacer cambios importantes')}</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span>{t('Guarda los backups en múltiples ubicaciones (nube, disco externo, etc.)')}</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span>{t('Verifica periódicamente que los backups se puedan restaurar correctamente')}</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span>{t('Mantén al menos 3 copias de backups recientes')}</span>
          </li>
        </ul>
      </div>
        </div>
      )}
    </div>
  );
}
