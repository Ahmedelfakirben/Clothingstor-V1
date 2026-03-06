import { useState, useEffect } from 'react';
import { Plus, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'react-hot-toast';
import { Expense, ExpenseCategory, Supplier } from '../types/expenses';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'supplier', label: 'Proveedores' },
  { value: 'salary', label: 'Salarios' },
  { value: 'rent', label: 'Alquiler' },
  { value: 'utilities', label: 'Servicios' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'other', label: 'Otros' },
];

export function ExpenseManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [newExpense, setNewExpense] = useState({
    category: '' as string,
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    employee_id: '',
  });

  useEffect(() => {
    fetchExpenses();
    fetchSuppliers();
  }, [filterCategory, dateRange]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      toast.error(t('Error al cargar proveedores'));
    }
  };

  const fetchExpenses = async () => {
    try {
      let query = supabase
        .from('expenses')
        .select('*')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false });

      if (filterCategory !== 'all') {
        // Check if it's a supplier ID or a category
        const isSupplier = suppliers.some(s => s.id === filterCategory);
        if (isSupplier) {
          query = query.eq('supplier_id', filterCategory);
        } else {
          query = query.eq('category', filterCategory);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      toast.error(t('Error al cargar gastos'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Determine category and supplier_id based on selection
      let category: ExpenseCategory = 'other';
      let supplierId: string | null = null;

      if (suppliers.some(s => s.id === newExpense.supplier_id)) {
        // It's a supplier
        category = 'supplier';
        supplierId = newExpense.supplier_id;
      } else {
        // It's a regular category
        category = newExpense.supplier_id as ExpenseCategory;
      }

      const { error } = await supabase
        .from('expenses')
        .insert({
          date: newExpense.date,
          category: category,
          description: newExpense.description,
          amount: parseFloat(newExpense.amount),
          supplier_id: supplierId,
          employee_id: user?.id ?? null,
        });

      if (error) throw error;

      toast.success(t('Gasto registrado exitosamente'));
      setShowForm(false);
      setNewExpense({
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        employee_id: '',
      });
      await fetchExpenses();
    } catch (err) {
      console.error('Error creating expense:', err);
      toast.error(t('Error al registrar gasto'));
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    const csvContent = [
      ['Fecha', 'Categoría/Proveedor', 'Descripción', 'Monto'],
      ...expenses.map(expense => [
        new Date(expense.date).toLocaleDateString(),
        suppliers.find(s => s.id === expense.supplier_id)?.name ||
        EXPENSE_CATEGORIES.find(cat => cat.value === expense.category)?.label ||
        expense.category,
        expense.description,
        formatCurrency(expense.amount)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gastos_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
  };

  const calculateTotal = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Gastos')}</h2>
        <div className="flex gap-4">
          <button
            onClick={downloadReport}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            {t('Descargar Reporte')}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('Nuevo Gasto')}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow mb-8 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Fecha')}
              </label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Categoría / Proveedor')}
              </label>
              <select
                value={newExpense.supplier_id}
                onChange={(e) => setNewExpense({ ...newExpense, supplier_id: e.target.value, category: e.target.value ? 'supplier' : '' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              >
                <option value="">{t('Seleccionar categoría o proveedor')}</option>
                <optgroup label={t('Otras categorías')}>
                  <option value="salary">{t('Salarios')}</option>
                  <option value="rent">{t('Alquiler')}</option>
                  <option value="utilities">{t('Servicios')}</option>
                  <option value="maintenance">{t('Mantenimiento')}</option>
                  <option value="other">{t('Otros')}</option>
                </optgroup>
                <optgroup label={t('Proveedores')}>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Descripción')}
              </label>
              <input
                type="text"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Monto')}
              </label>
              <input
                type="number"
                step="0.01"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
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
              {loading ? t('Guardando...') : t('Guardar Gasto')}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Categoría / Proveedor')}
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | 'all')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">{t('Todas las categorías')}</option>
              <optgroup label={t('Otras categorías')}>
                <option value="salary">{t('Salarios')}</option>
                <option value="rent">{t('Alquiler')}</option>
                <option value="utilities">{t('Servicios')}</option>
                <option value="maintenance">{t('Mantenimiento')}</option>
                <option value="other">{t('Otros')}</option>
              </optgroup>
              <optgroup label={t('Proveedores')}>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Fecha Inicial')}
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Fecha Final')}
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">{t('Lista de Gastos')}</h3>
            <div className="text-lg font-bold text-amber-600">
              {t('Total')}: {formatCurrency(calculateTotal())}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Fecha')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Categoría / Proveedor')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Descripción')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Monto')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {suppliers.find(s => s.id === expense.supplier_id)?.name ||
                      EXPENSE_CATEGORIES.find(cat => cat.value === expense.category)?.label ||
                      expense.category}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {expense.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(expense.amount)}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    {t('No hay gastos registrados en este período')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}