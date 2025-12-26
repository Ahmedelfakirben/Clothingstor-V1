import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { Shield, Check, X, Save, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from './LoadingSpinner';

interface RolePermission {
  id: string;
  role: string;
  section: string;
  page_id: string;
  can_access: boolean;
  can_confirm_order?: boolean;
  can_validate_order?: boolean;
}

interface Permission {
  section: string;
  page_id: string;
  page_label: string;
  can_access: boolean;
  can_confirm_order?: boolean;
  can_validate_order?: boolean;
}

const ROLES = [
  { id: 'super_admin', label: 'Super Administrador', color: 'from-purple-500 to-purple-600' },
  { id: 'admin', label: 'Administrador', color: 'from-blue-500 to-blue-600' },
  { id: 'cashier', label: 'Cajero', color: 'from-green-500 to-green-600' },
];

const SECTIONS = {
  'Ventas': [
    { id: 'pos', label: 'Punto de Venta' },
    { id: 'orders', label: 'Órdenes' },
  ],
  'Inventario': [
    { id: 'products', label: 'Productos' },
    { id: 'categories', label: 'Categorías' },
    { id: 'users', label: 'Usuarios' },
  ],
  'Finanzas': [
    { id: 'cash', label: 'Caja' },
    { id: 'time-tracking', label: 'Tiempo Empleados' },
    { id: 'suppliers', label: 'Proveedores' },
    { id: 'expenses', label: 'Gastos' },
    { id: 'analytics', label: 'Analíticas' },
    { id: 'stock-analytics', label: 'Análisis de Stock' },
  ],
  'Sistema': [
    { id: 'role-management', label: 'Gestión de Roles' },
  ],
};

export function RoleManagement() {
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, [selectedRole]);

  useEffect(() => {
    // Detectar cambios
    const changed = JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
    setHasChanges(changed);
  }, [permissions, originalPermissions]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', selectedRole);

      if (error) throw error;

      // Crear mapa de permisos con datos completos
      const permissionsMap = new Map<string, RolePermission>();
      data?.forEach(perm => {
        permissionsMap.set(`${perm.section}-${perm.page_id}`, perm);
      });

      // Generar lista completa de permisos
      const allPermissions: Permission[] = [];
      Object.entries(SECTIONS).forEach(([section, pages]) => {
        pages.forEach(page => {
          const key = `${section}-${page.id}`;
          const existingPerm = permissionsMap.get(key);
          allPermissions.push({
            section,
            page_id: page.id,
            page_label: page.label,
            can_access: existingPerm?.can_access ?? false,
            can_confirm_order: existingPerm?.can_confirm_order ?? true,
            can_validate_order: existingPerm?.can_validate_order ?? true,
          });
        });
      });

      setPermissions(allPermissions);
      setOriginalPermissions(JSON.parse(JSON.stringify(allPermissions)));
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error(t('Error al cargar permisos'));
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (section: string, page_id: string) => {
    setPermissions(prev =>
      prev.map(perm =>
        perm.section === section && perm.page_id === page_id
          ? { ...perm, can_access: !perm.can_access }
          : perm
      )
    );
  };

  const toggleConfirmOrder = (section: string, page_id: string) => {
    setPermissions(prev =>
      prev.map(perm =>
        perm.section === section && perm.page_id === page_id
          ? { ...perm, can_confirm_order: !perm.can_confirm_order }
          : perm
      )
    );
  };

  const toggleValidateOrder = (section: string, page_id: string) => {
    setPermissions(prev =>
      prev.map(perm =>
        perm.section === section && perm.page_id === page_id
          ? { ...perm, can_validate_order: !perm.can_validate_order }
          : perm
      )
    );
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      // Eliminar permisos existentes del rol
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role', selectedRole);

      if (deleteError) throw deleteError;

      // Insertar nuevos permisos
      const permissionsToInsert = permissions.map(perm => ({
        role: selectedRole,
        section: perm.section,
        page_id: perm.page_id,
        can_access: perm.can_access,
        can_confirm_order: perm.can_confirm_order ?? true,
        can_validate_order: perm.can_validate_order ?? true,
      }));

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(permissionsToInsert);

      if (insertError) throw insertError;

      toast.success(t('Permisos actualizados correctamente'));
      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(t('Error al guardar permisos'));
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
    setHasChanges(false);
  };



  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Roles y Permisos')}</h2>
              <p className="text-sm text-gray-600">{t('Configure los accesos para cada rol del sistema')}</p>
            </div>
          </div>

          {hasChanges && (
            <div className="flex gap-2">
              <button
                onClick={resetChanges}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t('Deshacer')}
              </button>
              <button
                onClick={savePermissions}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" light />
                    {t('Guardando...')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('Guardar Cambios')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Selector de Roles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`p-4 rounded-xl transition-all border-2 ${selectedRole === role.id
                ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm'
                }`}
            >
              <div className="text-center">
                <Shield className="w-6 h-6 mx-auto mb-2" />
                <p className="font-semibold text-sm">{t(role.label)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
            <p className="text-gray-600">{t('Cargando permisos...')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(SECTIONS).map(([sectionName, pages]) => {
            const sectionPermissions = permissions.filter(p => p.section === sectionName);
            const allEnabled = sectionPermissions.every(p => p.can_access);
            const someEnabled = sectionPermissions.some(p => p.can_access);

            return (
              <div key={sectionName} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-gray-100 to-gray-50 border-b flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">{t(sectionName)}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">
                      {sectionPermissions.filter(p => p.can_access).length} / {sectionPermissions.length} {t('habilitadas')}
                    </span>
                    {allEnabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        {t('Acceso completo')}
                      </span>
                    )}
                    {!allEnabled && someEnabled && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                        {t('Acceso parcial')}
                      </span>
                    )}
                    {!someEnabled && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                        {t('Sin acceso')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pages.map((page) => {
                      const permission = sectionPermissions.find(p => p.page_id === page.id);
                      const isEnabled = permission?.can_access ?? false;
                      const isPOS = page.id === 'pos';

                      return (
                        <div
                          key={page.id}
                          className={`p-4 rounded-lg border-2 transition-all ${isEnabled
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                            }`}
                        >
                          {/* Header con toggle principal */}
                          <button
                            onClick={() => togglePermission(sectionName, page.id)}
                            className="w-full"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-left flex-1">
                                <p className={`font-semibold ${isEnabled ? 'text-green-900' : 'text-gray-700'}`}>
                                  {t(page.label)}
                                </p>
                                <p className={`text-xs mt-1 ${isEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                                  {page.id}
                                </p>
                              </div>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEnabled ? 'bg-green-500' : 'bg-gray-300'
                                }`}>
                                {isEnabled ? (
                                  <Check className="w-6 h-6 text-white" />
                                ) : (
                                  <X className="w-6 h-6 text-gray-600" />
                                )}
                              </div>
                            </div>
                          </button>

                          {/* Opciones granulares para Punto de Venta */}
                          {isPOS && isEnabled && (
                            <div className="mt-3 pt-3 border-t border-green-200 space-y-2">
                              <p className="text-xs font-semibold text-green-800 mb-2">{t('Permisos específicos:')}</p>

                              <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={permission?.can_confirm_order ?? true}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleConfirmOrder(sectionName, page.id);
                                  }}
                                  className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                  {t('Confirmar pedidos')}
                                </span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={permission?.can_validate_order ?? true}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleValidateOrder(sectionName, page.id);
                                  }}
                                  className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                  {t('Validar pedidos (finalizar con pago)')}
                                </span>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nota informativa */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">{t('Información sobre roles:')}</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li><strong>{t('Super Administrador')}:</strong> {t('Acceso completo incluyendo gestión de roles')}</li>
              <li><strong>{t('Administrador')}:</strong> {t('Acceso completo excepto gestión de roles')}</li>
              <li><strong>{t('Cajero')}:</strong> {t('Ventas y gestión de caja')}</li>
              <li><strong>{t('Barista')}:</strong> {t('Solo sección de ventas')}</li>
              <li><strong>{t('Camarero')}:</strong> {t('Sala y órdenes (sin validar pedidos)')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
