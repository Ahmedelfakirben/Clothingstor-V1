
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Plus, Search, Edit, Trash2, User, Phone, Mail, Save, X, ClipboardList, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from './LoadingSpinner';

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    loyalty_points: number;
    created_at: string;
}

export function ClientsManager() {
    const { t } = useLanguage();
    const { formatCurrency } = useCurrency();
    // const { profile } = useAuth(); // Unused
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
    });
    const [saving, setSaving] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyOrders, setHistoryOrders] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<Customer | null>(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name');

            if (error) throw error;
            setCustomers(data || []);
        } catch (err: any) {
            console.error('Error fetching customers:', err);
            toast.error(t('clients.error_load'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error(t('clients.name_required'));
            return;
        }

        setSaving(true);
        try {
            if (editingCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update(formData)
                    .eq('id', editingCustomer.id);
                if (error) throw error;
                toast.success(t('clients.updated_success'));
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([formData]);
                if (error) throw error;
                toast.success(t('clients.created_success'));
            }
            setShowModal(false);
            resetForm();
            fetchCustomers();
        } catch (err: any) {
            console.error('Error saving customer:', err);
            toast.error(t('clients.error_save'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('clients.delete_confirm'))) return;

        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success(t('clients.deleted_success'));
            fetchCustomers();
        } catch (err: any) {
            console.error('Error deleting customer:', err);
            toast.error(t('clients.error_delete'));
        }
    };

    const fetchCustomerHistory = async (customer: Customer) => {
        setSelectedCustomerHistory(customer);
        setShowHistoryModal(true);
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
id,
    order_number,
    total,
    status,
    created_at,
    order_items(
        quantity,
        products(name)
    )
        `)
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistoryOrders(data || []);
        } catch (err: any) {
            console.error('Error fetching history:', err);
            toast.error(t('common.error'));
        } finally {
            setHistoryLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', email: '', phone: '' });
        setEditingCustomer(null);
    };

    const openEditModal = (customer: Customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name,
            email: customer.email || '',
            phone: customer.phone || '',
        });
        setShowModal(true);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <LoadingSpinner />;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('clients.management')}</h1>
                    <p className="text-gray-500">{t('clients.management_desc')}</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    <span>{t('clients.new_customer')}</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder={t('clients.search_placeholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm font-semibold border-b">
                            <tr>
                                <th className="px-6 py-3">{t('clients.name')}</th>
                                <th className="px-6 py-3">{t('Contacto')}</th>
                                <th className="px-6 py-3">{t('clients.points')}</th>
                                <th className="px-6 py-3 text-right">{t('clients.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredCustomers.length > 0 ? (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                                                    {customer.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{customer.name}</p>
                                                    <p className="text-xs text-gray-500">{t('clients.registered_date')} {new Date(customer.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div className="flex flex-col gap-1">
                                                {customer.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-3 h-3 text-gray-400" />
                                                        <span>{customer.phone}</span>
                                                    </div>
                                                )}
                                                {customer.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-3 h-3 text-gray-400" />
                                                        <span>{customer.email}</span>
                                                    </div>
                                                )}
                                                {!customer.phone && !customer.email && <span className="text-gray-400 italic">{t('clients.contact_none')}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                {customer.loyalty_points} pts
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => fetchCustomerHistory(customer)}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title={t('clients.history_title')}
                                                >
                                                    <ClipboardList className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(customer)}
                                                    className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                                                    title={t('common.edit')}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(customer.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title={t('common.delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p className="font-medium">{t('clients.no_customers')}</p>
                                        <p className="text-sm">{t('clients.add_one')}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingCustomer ? t('clients.edit_customer') : t('clients.new_customer')}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.name')} *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                        placeholder="Ej. Juan Pérez"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.phone')}</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                        placeholder="+34 600 000 000"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.email')}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                        placeholder="cliente@email.com"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>{saving ? t('common.loading') : t('common.save')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* History Modal */}
            {showHistoryModal && selectedCustomerHistory && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-fadeIn">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {t('clients.history_title')}
                                </h2>
                                <p className="text-sm text-gray-500 flex items-center gap-2">
                                    <User className="w-3 h-3" />
                                    {selectedCustomerHistory.name}
                                </p>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            {historyLoading ? (
                                <LoadingSpinner />
                            ) : historyOrders.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 text-sm font-semibold border-b sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">{t('Orden')}</th>
                                            <th className="px-4 py-3">{t('Fecha')}</th>
                                            <th className="px-4 py-3">{t('Estado')}</th>
                                            <th className="px-4 py-3">{t('reports.detail')}</th>
                                            <th className="px-4 py-3 text-right">{t('Total:')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {historyOrders.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 font-mono text-sm text-gray-600">
                                                    #{order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8)}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-600">
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                    <br />
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline - flex items - center gap - 1.5 px - 2.5 py - 1 rounded - full text - xs font - medium border ${order.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                        } `}>
                                                        {order.status === 'completed' ? <CheckCircle className="w-3 h-3" /> :
                                                            order.status === 'cancelled' ? <XCircle className="w-3 h-3" /> :
                                                                <Clock className="w-3 h-3" />}
                                                        <span className="capitalize">
                                                            {order.status === 'completed' ? t('Completado') :
                                                                order.status === 'cancelled' ? t('Cancelado') :
                                                                    t('Pendientes')}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-600">
                                                    <div className="max-w-[200px] truncate">
                                                        {order.order_items?.map((item: any) =>
                                                            `${item.quantity}x ${item.products?.name || 'Producto'} `
                                                        ).join(', ')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right font-medium text-gray-900">
                                                    {formatCurrency(order.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p>{t('clients.no_history')}</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-right">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                {t('Cerrar')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
