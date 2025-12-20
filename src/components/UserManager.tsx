import { useState, useEffect } from 'react';
import { Edit, Trash2, UserPlus, Mail, Phone, Shield, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { EmployeeProfile } from '../types/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface NewEmployee {
  email: string;
  password: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'cashier';
  phone: string;
}

export function UserManager() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newEmployee, setNewEmployee] = useState<NewEmployee>({
    email: '',
    password: '',
    full_name: '',
    role: 'cashier',
    phone: '',
  });

  // Estado para edición de correo y filtros de visibilidad
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchEmployees();
    }
  }, [profile]);

  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from('employee_profiles')
        .select('id, full_name, role, phone, active, created_at, email, deleted_at');

      // Solo super_admin puede ver otros super_admins
      if (profile?.role !== 'super_admin') {
        query = query.neq('role', 'super_admin');
      }

      const { data, error } = await query.order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
      toast.error(t('Error al cargar empleados'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que solo super_admin pueda crear super_admins
    if (newEmployee.role === 'super_admin' && profile?.role !== 'super_admin') {
      toast.error(t('Solo un Super Administrador puede crear otros Super Administradores'));
      return;
    }

    setLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmployee.email,
        password: newEmployee.password,
      } as any);

      if (authError) throw authError;
      if (!authData.user) throw new Error(t('No se pudo crear el usuario'));

      // 2. Create employee profile (store email for admin ops)
      const { error: profileError } = await supabase
        .from('employee_profiles')
        .insert({
          id: authData.user.id,
          full_name: newEmployee.full_name,
          role: newEmployee.role,
          phone: newEmployee.phone,
          email: newEmployee.email,
          active: true,
        });

      if (profileError) throw profileError;

      toast.success(t('Empleado creado exitosamente. Si la confirmación por email está habilitada, el usuario debe confirmar su correo.'));
      setShowForm(false);
      setNewEmployee({
        email: '',
        password: '',
        full_name: '',
        role: 'cashier',
        phone: '',
      });
      await fetchEmployees();
    } catch (err) {
      console.error('Error creating employee:', err);
      toast.error(t('Error al crear empleado'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (employee: EmployeeProfile) => {
    try {
      const { error } = await supabase
        .from('employee_profiles')
        .update({ active: !employee.active })
        .eq('id', employee.id);

      if (error) throw error;
      toast.success(`${t('Usuario')} ${employee.active ? t('desactivado') : t('activado')}`);
      await fetchEmployees();
    } catch (err) {
      console.error('Error toggling employee status:', err);
      toast.error(t('Error al actualizar estado del empleado'));
    }
  };

  // Inicio/fin de edición y actualización de correo
  const startEmailEdit = (employee: EmployeeProfile) => {
    if (employee.deleted_at) return;
    setEditingEmailId(employee.id);
    setEditingEmailValue(employee.email || '');
  };

  const cancelEmailEdit = () => {
    setEditingEmailId(null);
    setEditingEmailValue('');
  };

  const handleUpdateEmail = async () => {
    try {
      if (!editingEmailId) return;
      const value = editingEmailValue.trim();
      const { error } = await supabase
        .from('employee_profiles')
        .update({ email: value || null })
        .eq('id', editingEmailId);
      if (error) throw error;
      toast.success(t('Correo actualizado'));
      cancelEmailEdit();
      await fetchEmployees();
    } catch (err) {
      console.error('Error actualizando correo:', err);
      toast.error(t('No se pudo actualizar el correo'));
    }
  };

  // Acciones de administración existentes (contraseña y borrado lógico)
  const handleResetPassword = async (employee: EmployeeProfile) => {
    try {
      if (!employee.email) {
        toast.error(t('Este usuario no tiene correo guardado'));
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(employee.email, {
        redirectTo: window.location.origin,
      } as any);
      if (error) throw error;
      toast.success(t('Email de restablecimiento enviado'));
    } catch (err) {
      console.error('Error enviando reset de contraseña:', err);
      toast.error(t('No se pudo enviar el email de restablecimiento'));
    }
  };

  const handleSoftDelete = async (employee: EmployeeProfile) => {
    try {
      const confirmed = window.confirm(`${t('Eliminar lógicamente a')} ${employee.full_name}?`);
      if (!confirmed) return;
      const { error } = await supabase
        .from('employee_profiles')
        .update({ active: false, deleted_at: new Date().toISOString() })
        .eq('id', employee.id);
      if (error) throw error;
      toast.success(t('Usuario eliminado (borrado lógico)'));
      await fetchEmployees();
    } catch (err) {
      console.error('Error eliminando usuario:', err);
      toast.error(t('No se pudo eliminar el usuario'));
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'cashier':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return t('Super Administrador');
      case 'admin':
        return t('Administrador');
      case 'cashier':
        return t('Cajero');
      default:
        return role;
    }
  };

  // Aplicar filtros en la lista mostrada
  const filteredEmployees = employees.filter((e) => (showDeleted || !e.deleted_at) && (showInactive || e.active));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Usuarios')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          {t('Nuevo Empleado')}
        </button>
      </div>

      {/* Filtros de visibilidad */}
      <div className="flex items-center gap-6 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
          {t('Mostrar eliminados')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('Mostrar inactivos')}
        </label>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow mb-8 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Nombre Completo')}
              </label>
              <input
                type="text"
                value={newEmployee.full_name}
                onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Correo Electrónico')}
              </label>
              <input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Contraseña')}
              </label>
              <input
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Teléfono')}
              </label>
              <input
                type="tel"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Rol')}
              </label>
              <select
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                required
              >
                <option value="cashier">{t('Cajero')}</option>
                {profile?.role === 'super_admin' && (
                  <>
                    <option value="admin">{t('Administrador')}</option>
                    <option value="super_admin">{t('Super Administrador')}</option>
                  </>
                )}
                {profile?.role === 'admin' && (
                  <option value="admin">{t('Administrador')}</option>
                )}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('Cancelar')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? t('Creando...') : t('Crear Empleado')}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('Empleado')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('Contacto')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('Correo')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('Rol')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('Estado')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('Acciones')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmployees.map((employee) => (
              <tr key={employee.id} className={!employee.active ? 'bg-gray-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{employee.full_name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {employee.phone || t('No registrado')}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {editingEmailId === employee.id ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <input
                        type="email"
                        value={editingEmailValue}
                        onChange={(e) => setEditingEmailValue(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded"
                        placeholder={t('correo@ejemplo.com')}
                      />
                      <button
                        onClick={handleUpdateEmail}
                        className="text-green-600 hover:text-green-800"
                        title={t('Guardar correo')}
                      >
                        {t('Guardar')}
                      </button>
                      <button
                        onClick={cancelEmailEdit}
                        className="text-gray-600 hover:text-gray-800"
                        title={t('Cancelar edición')}
                      >
                        {t('Cancelar')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{employee.email || t('No registrado')}</span>
                      <button
                        onClick={() => startEmailEdit(employee)}
                        className="text-gray-500 hover:text-gray-700"
                        title={employee.deleted_at ? t('Usuario eliminado') : t('Editar correo')}
                        disabled={!!employee.deleted_at}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(employee.role)}`}>
                    {getRoleName(employee.role)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    employee.deleted_at
                      ? 'bg-gray-200 text-gray-800'
                      : employee.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {employee.deleted_at ? t('Eliminado') : employee.active ? t('Activo') : t('Inactivo')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center gap-4 justify-end">
                    <button
                      onClick={() => handleToggleActive(employee)}
                      className={`text-${employee.active ? 'red' : 'green'}-600 hover:text-${employee.active ? 'red' : 'green'}-900`}
                      disabled={!!employee.deleted_at}
                    >
                      {employee.active ? t('Desactivar') : t('Activar')}
                    </button>
                    <button
                      onClick={() => handleResetPassword(employee)}
                      className="text-amber-600 hover:text-amber-900 flex items-center gap-1"
                      disabled={!employee.email}
                      title={employee.email ? t('Enviar reset de contraseña') : t('Sin correo')}
                    >
                      <KeyRound className="w-4 h-4" /> {t('Reset')}
                    </button>
                    <button
                      onClick={() => handleSoftDelete(employee)}
                      className="text-red-600 hover:text-red-900 flex items-center gap-1"
                      disabled={!!employee.deleted_at}
                    >
                      <Trash2 className="w-4 h-4" /> {t('Eliminar')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}