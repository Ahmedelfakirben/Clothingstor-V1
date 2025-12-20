import { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { LoadingSpinner } from './LoadingSpinner';

interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export function CategoryManager() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      console.log('Fetching categories...');
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }

      console.log('Categories loaded:', data?.length || 0);
      setCategories(data || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      toast.error(`${t('Error al cargar categorías:')} ${err.message || t('Error desconocido')}`);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setLoading(true);
    try {
      console.log('Submitting category:', { editingCategory, newCategory });

      if (editingCategory) {
        console.log('Updating category:', editingCategory.id, 'to:', newCategory);
        const { data, error } = await supabase
          .from('categories')
          .update({ name: newCategory })
          .eq('id', editingCategory.id)
          .select();

        if (error) {
          console.error('Update error:', error);
          throw error;
        }

        console.log('Update successful:', data);
        toast.success(t('Categoría actualizada correctamente'));
      } else {
        console.log('Creating new category:', newCategory);
        const { data, error } = await supabase
          .from('categories')
          .insert({ name: newCategory })
          .select();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }

        console.log('Insert successful:', data);
        toast.success(t('Categoría creada correctamente'));
      }

      setNewCategory('');
      setEditingCategory(null);
      await fetchCategories();
    } catch (err: any) {
      console.error('Error saving category:', err);
      toast.error(`${t('Error al guardar la categoría:')} ${err.message || t('Error desconocido')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    console.log('Editing category:', category);
    setEditingCategory(category);
    setNewCategory(category.name);
  };

  const handleDelete = async (id: string) => {
    const category = categories.find(c => c.id === id);
    if (!category) return;

    if (!confirm(`${t('¿Estás seguro de eliminar la categoría')} "${category.name}"?\n\n${t('Esta acción no se puede deshacer.')}`)) return;

    try {
      // First check if category is being used by products
      const { data: products, error: checkError } = await supabase
        .from('products')
        .select('id, name')
        .eq('category_id', id)
        .limit(5);

      if (checkError) {
        console.error('Error checking category usage:', checkError);
        toast.error(t('Error al verificar el uso de la categoría'));
        return;
      }

      if (products && products.length > 0) {
        toast.error(`${t('No se puede eliminar la categoría porque está siendo usada por')} ${products.length} ${t('producto(s). Elimine o reasigne los productos primero.')}`);
        return;
      }

      console.log('Deleting category:', id);
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      toast.success(t('Categoría eliminada correctamente'));
      await fetchCategories();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      toast.error(`${t('Error al eliminar la categoría:')} ${err.message || t('Error desconocido')}`);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Categorías')}</h2>
        <button
          onClick={fetchCategories}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          title={t('Actualizar lista')}
        >
          <RefreshCw className="w-4 h-4" />
          {t('Actualizar')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-sm p-6 border">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {editingCategory ? t('Editando Categoría') : t('Nueva Categoría')}
            </label>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder={editingCategory ? `${t('Editando:')} ${editingCategory.name}` : t("Nombre de la categoría")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newCategory.trim()}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? t('Guardando...') : editingCategory ? t('Actualizar') : t('Crear')}
          </button>
          {editingCategory && (
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setNewCategory('');
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {t('Cancelar')}
            </button>
          )}
        </div>
        {editingCategory && (
          <div className="mt-2 text-sm text-gray-600">
            {t('Modificando categoría:')} <span className="font-medium">{editingCategory.name}</span>
          </div>
        )}
      </form>

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {t('Categorías Existentes')} {categories.length > 0 && `(${categories.length})`}
          </h3>
        </div>
        {loadingCategories ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <div className="mb-4 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
            {t('Cargando categorías...')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {categories.map((category) => (
              <li key={category.id} className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <span className="text-gray-900 font-medium">{category.name}</span>
                  <div className="text-sm text-gray-500 mt-1">
                    {t('Creada:')} {new Date(category.created_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 p-2 rounded-lg transition-colors"
                    title={t('Editar categoría')}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title={t('Eliminar categoría')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
            {categories.length === 0 && (
              <li className="px-4 py-8 text-gray-500 text-center">
                <div className="text-lg mb-2">📂</div>
                {t('No hay categorías creadas')}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}