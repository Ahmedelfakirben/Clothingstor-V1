import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import {
    ShoppingBag,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Package,
    Truck,
    CheckCircle,
    XCircle,
    Clock,
    User,
    Phone,
    MapPin,
    ExternalLink,
    DollarSign,
    ClipboardList
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface OnlineOrder {
    id: string;
    order_number: number;
    created_at: string;
    total: number;
    status: string;
    payment_status: string;
    payment_method: string;
    delivery_address: string;
    delivery_notes: string;
    customer: {
        full_name: string;
        email: string;
        phone: string;
    };
    items?: OnlineOrderItem[];
    customer_id: string;
}

interface OnlineOrderItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    product_size: string;
}

interface CustomerProfile {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    default_address: string;
    created_at: string;
}

export function OnlineStoreManager() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'orders' | 'customers'>('orders');
    const [orders, setOrders] = useState<OnlineOrder[]>([]);
    const [customers, setCustomers] = useState<CustomerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // States for Customer Details View
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [customerOrders, setCustomerOrders] = useState<OnlineOrder[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (activeTab === 'orders') {
            fetchOrders();
        } else {
            fetchCustomers();
        }
    }, [activeTab]);

    // Fetch orders for a specific customer when selected
    useEffect(() => {
        if (selectedCustomerId) {
            fetchCustomerOrders(selectedCustomerId);
        }
    }, [selectedCustomerId]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('online_orders')
                .select(`
          *,
          customer:customer_profiles(full_name, email, phone),
          items:order_items_online(id, product_name, quantity, unit_price, product_size)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error('Error fetching online orders:', err);
            toast.error('Error al cargar pedidos online');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('customer_profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            console.error('Error fetching customers:', err);
            toast.error('Error al cargar clientes');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerOrders = async (customerId: string) => {
        try {
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('online_orders')
                .select(`
          *,
          items:order_items_online(id, product_name, quantity, unit_price, product_size)
        `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomerOrders(data || []);
        } catch (err) {
            console.error('Error fetching customer history:', err);
            toast.error('Error al cargar historial del cliente');
        } finally {
            setLoadingHistory(false);
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            setUpdatingId(orderId);
            const { error } = await supabase
                .from('online_orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            toast.success(`Estado actualizado a: ${getStatusLabel(newStatus)}`);

            // Update local state (both main list and customer history if active)
            setOrders(orders.map(o =>
                o.id === orderId ? { ...o, status: newStatus } : o
            ));

            if (selectedCustomerId) {
                setCustomerOrders(customerOrders.map(o =>
                    o.id === orderId ? { ...o, status: newStatus } : o
                ));
            }
        } catch (err) {
            console.error('Error updating status:', err);
            toast.error('Error al actualizar estado');
        } finally {
            setUpdatingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'preparing': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'ready': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'shipped': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Helper for Translation Status Labels
    const getStatusLabelKey = (status: string) => {
        switch (status) {
            case 'pending': return 'online.status.pending';
            case 'confirmed': return 'online.status.confirmed';
            case 'preparing': return 'online.status.preparing';
            case 'ready': return 'online.status.ready';
            case 'shipped': return 'online.status.shipped';
            case 'delivered': return 'online.status.delivered';
            case 'cancelled': return 'online.status.cancelled';
            default: return status;
        }
    };

    const filteredOrders = filterStatus === 'all'
        ? orders
        : orders.filter(o => o.status === filterStatus);

    const selectedCustomerProfile = customers.find(c => c.id === selectedCustomerId);

    return (
        <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ShoppingBag className="w-8 h-8 text-amber-600" />
                            {t('online.title')}
                        </h1>
                        <p className="text-gray-500 mt-1">{t('online.subtitle')}</p>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => { setActiveTab('orders'); setSelectedCustomerId(null); }}
                            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'orders' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            {t('online.orders')}
                        </button>
                        <button
                            onClick={() => setActiveTab('customers')}
                            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'customers' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            {t('online.users')}
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'orders' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{t('online.stats.pending')}</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {orders.filter(o => o.status === 'pending').length}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                <Package className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{t('online.stats.processing')}</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                                <Truck className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{t('online.stats.shipped')}</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {orders.filter(o => o.status === 'shipped').length}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{t('online.stats.delivered')}</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {orders.filter(o => o.status === 'delivered').length}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h2 className="font-bold text-lg text-gray-800">{t('online.orders_list')}</h2>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 px-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                                >
                                    <option value="all">{t('online.filter.all')}</option>
                                    <option value="pending">{t('online.status.pending')}</option>
                                    <option value="confirmed">{t('online.status.confirmed')}</option>
                                    <option value="preparing">{t('online.status.preparing')}</option>
                                    <option value="shipped">{t('online.status.shipped')}</option>
                                    <option value="delivered">{t('online.status.delivered')}</option>
                                    <option value="cancelled">{t('online.status.cancelled')}</option>
                                </select>
                                <Filter className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            <button
                                onClick={fetchOrders}
                                className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl transition-colors"
                                title={t('common.search')}
                            >
                                <Clock className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Orders List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                        <div className="overflow-y-auto flex-1 p-2">
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
                                    <p>{t('online.no_orders')}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredOrders.map((order) => (
                                        <div
                                            key={order.id}
                                            className={`border rounded-xl transition-all duration-200 overflow-hidden ${expandedOrder === order.id ? 'border-amber-200 shadow-md bg-amber-50/10' : 'border-gray-100 hover:border-amber-200 hover:shadow-sm'
                                                }`}
                                        >
                                            {/* Order Summary Row */}
                                            <div
                                                className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4 cursor-pointer"
                                                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-mono font-bold text-gray-900">#{order.order_number}</span>
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                                            {t(getStatusLabelKey(order.status))}
                                                        </span>
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-4 h-4 text-gray-400" />
                                                            <span className="font-medium">{order.customer?.full_name || t('online.unknown_client')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-gray-900">{order.items?.length || 0} {t('online.items')}</span>
                                                            <span>•</span>
                                                            <span className="font-bold text-amber-600">{order.total.toFixed(2)} DH</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0" onClick={e => e.stopPropagation()}>
                                                    <select
                                                        value={order.status}
                                                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                                        disabled={updatingId === order.id}
                                                        className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2 w-full md:w-48 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50"
                                                    >
                                                        <option value="pending">⏳ {t('online.status.pending')}</option>
                                                        <option value="confirmed">✅ {t('online.status.confirmed')}</option>
                                                        <option value="preparing">📦 {t('online.status.preparing')}</option>
                                                        <option value="shipped">🚚 {t('online.status.shipped')}</option>
                                                        <option value="delivered">🏠 {t('online.status.delivered')}</option>
                                                        <option value="cancelled">❌ {t('online.status.cancelled')}</option>
                                                    </select>

                                                    <button
                                                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                                    >
                                                        {expandedOrder === order.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {expandedOrder === order.id && (
                                                <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-fadeIn">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Customer Info */}
                                                        <div className="space-y-3">
                                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                                <User className="w-4 h-4 text-amber-600" />
                                                                {t('online.customer_data')}
                                                            </h3>
                                                            <div className="bg-white p-3 rounded-lg border border-gray-100 text-sm space-y-2">
                                                                <p><span className="text-gray-500">{t('online.email')}:</span> {order.customer?.email}</p>
                                                                <p><span className="text-gray-500">{t('online.phone')}:</span> {order.customer?.phone || t('clients.contact_none')}</p>
                                                                <div className="flex items-start gap-1">
                                                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                                                    <div>
                                                                        <p className="font-medium">{t('online.address')}:</p>
                                                                        <p className="text-gray-600">{order.delivery_address || t('clients.contact_none')}</p>
                                                                    </div>
                                                                </div>
                                                                {order.delivery_notes && (
                                                                    <div className="mt-2 bg-yellow-50 p-2 rounded text-yellow-800 text-xs">
                                                                        <strong>{t('online.note')}:</strong> {order.delivery_notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Order Items */}
                                                        <div className="space-y-3">
                                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                                <ShoppingBag className="w-4 h-4 text-amber-600" />
                                                                {t('online.products')} ({order.items?.length})
                                                            </h3>
                                                            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                                                                <table className="w-full text-sm text-left">
                                                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-3 py-2">{t('online.table.product')}</th>
                                                                            <th className="px-3 py-2">{t('online.table.qty')}</th>
                                                                            <th className="px-3 py-2 text-right">{t('online.table.price')}</th>
                                                                            <th className="px-3 py-2 text-right">{t('online.table.total')}</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {order.items?.map((item) => (
                                                                            <tr key={item.id}>
                                                                                <td className="px-3 py-2">
                                                                                    <p className="font-medium text-gray-900">{item.product_name}</p>
                                                                                    {item.product_size && (
                                                                                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                                                                            {item.product_size}
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                                                <td className="px-3 py-2 text-right">{item.unit_price.toFixed(2)}</td>
                                                                                <td className="px-3 py-2 text-right font-medium">{(item.quantity * item.unit_price).toFixed(2)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                    <tfoot className="bg-gray-50 font-bold text-gray-900">
                                                                        <tr>
                                                                            <td colSpan={3} className="px-3 py-2 text-right">{t('online.total_order')}:</td>
                                                                            <td className="px-3 py-2 text-right">{order.total.toFixed(2)}</td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    {!selectedCustomerId ? (
                        // Customer List View
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h2 className="text-lg font-bold text-gray-900">{t('online.users_db')}</h2>
                                <button
                                    onClick={fetchCustomers}
                                    className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors"
                                >
                                    <Clock className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : customers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <User className="w-16 h-16 mb-4 opacity-20" />
                                        <p>{t('online.no_users')}</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-3">{t('online.table.customer')}</th>
                                                    <th className="px-4 py-3">{t('online.table.contact')}</th>
                                                    <th className="px-4 py-3">{t('online.table.registered')}</th>
                                                    <th className="px-4 py-3">{t('online.table.address')}</th>
                                                    <th className="px-4 py-3 text-right">{t('online.table.action')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {customers.map((customer) => (
                                                    <tr
                                                        key={customer.id}
                                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                        onClick={() => setSelectedCustomerId(customer.id)}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs uppercase">
                                                                    {customer.full_name?.charAt(0) || '?'}
                                                                </div>
                                                                <span className="font-medium text-gray-900">{customer.full_name || t('clients.contact_none')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm">
                                                                <div className="text-gray-900">{customer.email}</div>
                                                                <div className="text-gray-500 text-xs">{customer.phone || '-'}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">
                                                            {new Date(customer.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                                                            {customer.default_address || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <ChevronDown className="w-4 h-4 text-gray-400 inline-block -rotate-90" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Customer Details View
                        <div className="h-full flex flex-col overflow-hidden">
                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 shrink-0">
                                <button
                                    onClick={() => setSelectedCustomerId(null)}
                                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                                >
                                    <ChevronDown className="w-6 h-6 rotate-90" />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{selectedCustomerProfile?.full_name}</h2>
                                    <p className="text-sm text-gray-500">{t('online.history_details')}</p>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    {/* Info Card */}
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                                        <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">{t('online.personal_info')}</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <User className="w-4 h-4" />
                                                <span>{selectedCustomerProfile?.full_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <ShoppingBag className="w-4 h-4" />
                                                <span>{selectedCustomerProfile?.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Phone className="w-4 h-4" />
                                                <span>{selectedCustomerProfile?.phone || t('clients.contact_none')}</span>
                                            </div>
                                            <div className="flex items-start gap-2 text-gray-600">
                                                <MapPin className="w-4 h-4 mt-0.5" />
                                                <span>{selectedCustomerProfile?.default_address || t('clients.contact_none')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="col-span-2 grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-blue-600 font-medium text-sm">{t('online.total_orders')}</p>
                                                <p className="text-2xl font-bold text-blue-900">{customerOrders.length}</p>
                                            </div>
                                            <ShoppingBag className="w-8 h-8 text-blue-200" />
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-green-600 font-medium text-sm">{t('online.total_spent')}</p>
                                                <p className="text-2xl font-bold text-green-900">
                                                    {customerOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)} DH
                                                </p>
                                            </div>
                                            <DollarSign className="w-8 h-8 text-green-200" />
                                        </div>
                                    </div>
                                </div>

                                <h3 className="font-bold text-gray-900 mb-4">{t('online.order_history')}</h3>

                                <div className="bg-gray-50 rounded-xl border border-gray-200 min-h-[500px] overflow-hidden">
                                    <div className="overflow-x-auto h-full">
                                        {loadingHistory ? (
                                            <div className="flex items-center justify-center p-8">
                                                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        ) : customerOrders.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                                                <ClipboardList className="w-12 h-12 mb-2 opacity-20" />
                                                <p>{t('online.no_history')}</p>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-100 text-gray-600 font-medium border-b border-gray-200 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-3"># {t('online.orders')}</th>
                                                        <th className="px-4 py-3">{t('online.table.registered')}</th>
                                                        <th className="px-4 py-3">{t('online.table.action')}</th>
                                                        <th className="px-4 py-3 text-right">{t('online.items')}</th>
                                                        <th className="px-4 py-3 text-right">{t('online.table.total')}</th>
                                                        <th className="px-4 py-3 text-center">{t('online.table.action')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 bg-white">
                                                    {customerOrders.map(order => (
                                                        <tr key={order.id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3 font-mono font-medium">#{order.order_number}</td>
                                                            <td className="px-4 py-3 text-gray-500">
                                                                {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                                                                    {t(getStatusLabelKey(order.status))}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">{order.items?.length || 0}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-900">{order.total.toFixed(2)} DH</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <select
                                                                    value={order.status}
                                                                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                                                    className="text-xs border-gray-200 rounded-lg p-1 bg-gray-50"
                                                                >
                                                                    <option value="pending">{t('online.status.pending')}</option>
                                                                    <option value="confirmed">{t('online.status.confirmed')}</option>
                                                                    <option value="preparing">{t('online.status.preparing')}</option>
                                                                    <option value="shipped">{t('online.status.shipped')}</option>
                                                                    <option value="delivered">{t('online.status.delivered')}</option>
                                                                    <option value="cancelled">{t('online.status.cancelled')}</option>
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
