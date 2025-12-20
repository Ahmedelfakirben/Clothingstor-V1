import { useState, useEffect } from 'react';
import { Cloud, Save, AlertCircle, CheckCircle2, Play, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LoadingSpinner } from './LoadingSpinner';
import {
  getBackupConfig,
  saveBackupConfig,
  createAutomatedBackup,
  getS3Info,
  testS3Connection,
  type BackupConfig,
} from '../lib/s3BackupService';

export function AutomatedBackupConfig() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<BackupConfig>({
    tables: [
      'products',
      'categories',
      'orders',
      'order_items',
      'employee_profiles',
      'cash_register_sessions',
      'role_permissions',
      'company_settings',
      'app_settings',
      'tables',
    ],
    s3_enabled: true,
    schedule_enabled: false,
    schedule_time: '02:00',
    schedule_frequency: 'daily',
    retention_days: 30,
  });
  const [s3Info] = useState(getS3Info());
  const [testingConnection, setTestingConnection] = useState(false);
  const [s3Connected, setS3Connected] = useState<boolean | null>(null);
  const [runningBackup, setRunningBackup] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await getBackupConfig();
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const success = await saveBackupConfig(config);
      if (success) {
        toast.success(t('Configuración guardada correctamente'));
      } else {
        toast.error(t('Error guardando configuración'));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const connected = await testS3Connection();
      setS3Connected(connected);
      if (connected) {
        toast.success(t('Conexión S3 exitosa'));
      } else {
        toast.error(t('Error conectando con S3'));
      }
    } catch (error) {
      setS3Connected(false);
      toast.error(t('Error verificando conexión'));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRunBackupNow = async () => {
    if (!user) return;

    setRunningBackup(true);
    try {
      const result = await createAutomatedBackup(user.id, config.tables);

      if (result.success) {
        toast.success(
          t(`Backup automático completado: ${result.total_records} registros (${result.size_mb} MB)`)
        );

        if (result.s3_url) {
          toast.success(t(`Subido a S3: ${result.s3_url}`));
        }
      } else {
        toast.error(t(`Error en backup: ${result.error}`));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRunningBackup(false);
    }
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
            {t('Solo el Super Administrador puede configurar backups automáticos.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Información de S3 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Cloud className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('Configuración de S3 Storage')}</h3>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('Endpoint')}</p>
              <p className="text-sm font-medium text-gray-900">{s3Info.endpoint}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('Bucket')}</p>
              <p className="text-sm font-medium text-gray-900">{s3Info.bucket}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('Región')}</p>
              <p className="text-sm font-medium text-gray-900">{s3Info.region}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('Estado')}</p>
              <div className="flex items-center gap-2">
                {s3Info.configured ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">{t('Configurado')}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">{t('No configurado')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection || !s3Info.configured}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {testingConnection ? (
              <>
                <LoadingSpinner size="sm" light />
                {t('Verificando...')}
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                {t('Probar Conexión')}
              </>
            )}
          </button>

          {s3Connected !== null && (
            <div className={`p-3 rounded-lg ${s3Connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <p className="text-sm">
                {s3Connected ? t('✓ Conexión exitosa con S3') : t('✗ Error conectando con S3')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuración de Programación */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('Programación de Backups')}</h3>
        </div>

        <div className="space-y-4">
          {/* Habilitar/Deshabilitar */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{t('Backups Automáticos')}</p>
              <p className="text-sm text-gray-600">{t('Ejecutar backups según programación')}</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, schedule_enabled: !config.schedule_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.schedule_enabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.schedule_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          {/* Subir a S3 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{t('Subir a S3 Storage')}</p>
              <p className="text-sm text-gray-600">{t('Guardar backups en S3 automáticamente')}</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, s3_enabled: !config.s3_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.s3_enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.s3_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          {/* Frecuencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Frecuencia')}
            </label>
            <select
              value={config.schedule_frequency}
              onChange={(e) => setConfig({ ...config, schedule_frequency: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="daily">{t('Diario')}</option>
              <option value="weekly">{t('Semanal')}</option>
              <option value="monthly">{t('Mensual')}</option>
            </select>
          </div>

          {/* Hora */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Hora de Ejecución')}
            </label>
            <input
              type="time"
              value={config.schedule_time}
              onChange={(e) => setConfig({ ...config, schedule_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('Los backups se ejecutarán a esta hora (zona horaria del servidor)')}
            </p>
          </div>

          {/* Retención */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Días de Retención')}
            </label>
            <input
              type="number"
              min="7"
              max="365"
              value={config.retention_days}
              onChange={(e) => setConfig({ ...config, retention_days: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('Los backups más antiguos se eliminarán automáticamente')}
            </p>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row gap-3">
          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" light />
                {t('Guardando...')}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('Guardar Configuración')}
              </>
            )}
          </button>

          <button
            onClick={handleRunBackupNow}
            disabled={runningBackup}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {runningBackup ? (
              <>
                <LoadingSpinner size="sm" light />
                {t('Ejecutando...')}
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                {t('Ejecutar Backup Ahora')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Información */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">{t('Información Importante')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('Los backups automáticos se ejecutarán en segundo plano')}</li>
              <li>{t('Se subirán a S3 si está habilitado')}</li>
              <li>{t('Los backups antiguos se limpiarán automáticamente')}</li>
              <li>{t('Puedes ejecutar backups manualmente en cualquier momento')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
