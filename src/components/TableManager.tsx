import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Edit2, Trash2, Grid3x3, Users, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from './LoadingSpinner';

interface Table {
  id: string;
  name: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved' | 'dirty';
  created_at: string;
  updated_at: string;
}

export function TableManager() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    seats: 4,
  });

  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('name');

      if (error) throw error;
      setTables(data || []);
    } catch (error: any) {
      console.error('Error fetching tables:', error);
      toast.error(t('Error al cargar mesas'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSuperAdmin) {
      toast.error(t('Solo el Super Administrador puede gestionar mesas'));
      return;
    }

    try {
      if (editingTable) {
        // Actualizar mesa existente
        const { error } = await supabase
          .from('tables')
          .update({
            name: formData.name,
            seats: formData.seats,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTable.id);

        if (error) throw error;
        toast.success(t('Mesa actualizada correctamente'));
      } else {
        // Crear nueva mesa
        const { error } = await supabase
          .from('tables')
          .insert({
            name: formData.name,
            seats: formData.seats,
            status: 'available',
          });

        if (error) throw error;
        toast.success(t('Mesa creada correctamente'));
      }

      setShowModal(false);
      setEditingTable(null);
      setFormData({ name: '', seats: 4 });
      fetchTables();
    } catch (error: any) {
      console.error('Error saving table:', error);
      toast.error(error.message || t('Error al guardar mesa'));
    }
  };

  const handleEdit = (table: Table) => {
    if (!isSuperAdmin) {
      toast.error(t('Solo el Super Administrador puede editar mesas'));
      return;
    }

    setEditingTable(table);
    setFormData({
      name: table.name,
      seats: table.seats,
    });
    setShowModal(true);
  };

  const handleDelete = async (tableId: string) => {
    if (!isSuperAdmin) {
      toast.error(t('Solo el Super Administrador puede eliminar mesas'));
      return;
    }

    if (!confirm(t('¿Estás seguro de eliminar esta mesa?'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;
      toast.success(t('Mesa eliminada correctamente'));
      fetchTables();
    } catch (error: any) {
      console.error('Error deleting table:', error);
      toast.error(error.message || t('Error al eliminar mesa'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 text-green-700';
      case 'occupied':
        return 'bg-gradient-to-br from-red-50 to-pink-50 border-red-300 text-red-700';
      case 'reserved':
        return 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 text-blue-700';
      case 'dirty':
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 text-gray-700';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'occupied':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Grid3x3 className="w-9 h-9 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                {t('Gestión de Mesas')}
              </h2>
              <p className="text-base text-gray-600 font-semibold">
                {t('Administra las mesas de tu restaurante')}
              </p>
            </div>
          </div>

          {isSuperAdmin && (
            <button
              onClick={() => {
                setEditingTable(null);
                setFormData({ name: '', seats: 4 });
                setShowModal(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('Nueva Mesa')}
            </button>
          )}
        </div>
      </div>

      {/* Info box si no es super admin */}
      {!isSuperAdmin && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 shadow-lg">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-sm text-blue-900">
              <p className="font-bold mb-2 text-base">{t('Solo lectura')}</p>
              <p className="font-medium">{t('Solo el Super Administrador puede añadir, editar o eliminar mesas.')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Grid de mesas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((table) => (
          <div
            key={table.id}
            className={`rounded-2xl border-2 p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${getStatusColor(table.status)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-md">
                  <Grid3x3 className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black">{table.name}</h3>
                  <p className="text-sm opacity-75 font-semibold">{t('Mesa')}</p>
                </div>
              </div>
              {getStatusIcon(table.status)}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              <span className="font-bold">{table.seats} {t('asientos')}</span>
            </div>

            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                table.status === 'available' ? 'bg-green-200 text-green-800' :
                table.status === 'occupied' ? 'bg-red-200 text-red-800' :
                table.status === 'reserved' ? 'bg-blue-200 text-blue-800' :
                'bg-gray-200 text-gray-800'
              }`}>
                {table.status === 'available' ? t('Disponible') :
                 table.status === 'occupied' ? t('Ocupada') :
                 table.status === 'reserved' ? t('Reservada') :
                 t('Sucia')}
              </span>
            </div>

            {isSuperAdmin && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/30">
                <button
                  onClick={() => handleEdit(table)}
                  className="flex-1 px-4 py-2 bg-white/80 backdrop-blur-sm hover:bg-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('Editar')}
                </button>
                <button
                  onClick={() => handleDelete(table.id)}
                  className="flex-1 px-4 py-2 bg-red-500/80 backdrop-blur-sm hover:bg-red-600 text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('Eliminar')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal para crear/editar mesa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-2xl font-black mb-6 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              {editingTable ? t('Editar Mesa') : t('Nueva Mesa')}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('Nombre de la Mesa')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 outline-none font-semibold"
                  placeholder={t('Ej: Mesa 1, A1, Terraza 1...')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('Número de Asientos')}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="20"
                  value={formData.seats}
                  onChange={(e) => setFormData({ ...formData, seats: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 outline-none font-semibold"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingTable(null);
                    setFormData({ name: '', seats: 4 });
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all duration-200"
                >
                  {t('Cancelar')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  {editingTable ? t('Actualizar') : t('Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
