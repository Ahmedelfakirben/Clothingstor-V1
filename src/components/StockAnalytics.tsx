
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Package, AlertTriangle, TrendingUp, Archive, AlertCircle, BarChart3, Search, X } from 'lucide-react';
import IndividualUnitsManager from './IndividualUnitsManager';



interface StockItem {
    id: string;
    name: string;
    totalStock: number;
    value: number;
    costValue: number;
    estimatedProfit: number;
    imageUrl?: string;
    status: 'ok' | 'low' | 'out';
    sold: number;
    sizes?: { name: string; stock: number }[];
}

interface BestSeller {
    name: string;
    quantity: number;
    revenue: number;
}

export function StockAnalytics() {
    const { t } = useLanguage();
    const { formatCurrency } = useCurrency();
    const [loading, setLoading] = useState(true);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
    const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);

    // KPIs
    const [totalItems, setTotalItems] = useState(0);
    const [totalValue, setTotalValue] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    const [totalPotentialProfit, setTotalPotentialProfit] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [outStockCount, setOutStockCount] = useState(0);

    useEffect(() => {
        fetchStockData();
    }, []);

    const fetchStockData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Products
            const { data: products, error: prodError } = await supabase
                .from('products')
                .select('id, name, base_price, purchase_price, stock, image_url')
                .eq('available', true);

            if (prodError) throw prodError;

            // 2. Fetch Sizes (for sized products)
            const { data: sizes, error: sizesError } = await supabase
                .from('product_sizes')
                .select('product_id, size_name, stock');

            if (sizesError) throw sizesError;

            // 3. Process Stock Logic
            const processedItems: StockItem[] = (products || []).map(product => {
                let currentStock = product.stock || 0;

                // If product has sizes, sum them up
                const productSizes = sizes?.filter(s => s.product_id === product.id);
                let sizesList: { name: string; stock: number }[] = [];

                if (productSizes && productSizes.length > 0) {
                    currentStock = productSizes.reduce((sum, s) => sum + s.stock, 0);
                    sizesList = productSizes.map(s => ({ name: s.size_name, stock: s.stock }));
                }

                let status: 'ok' | 'low' | 'out' = 'ok';
                if (currentStock === 0) status = 'out';
                else if (currentStock < 5) status = 'low';

                const costValue = currentStock * (product.purchase_price || 0);
                const value = currentStock * product.base_price;

                return {
                    id: product.id,
                    name: product.name,
                    totalStock: currentStock,
                    value: value,
                    costValue: costValue,
                    estimatedProfit: value - costValue,
                    imageUrl: product.image_url,
                    status,
                    sizes: sizesList.length > 0 ? sizesList : undefined
                };
            });



            // 5. Fetch ALL-TIME Sold Counts per Product
            const { data: allSalesData } = await supabase
                .from('order_items')
                .select('product_id, quantity');

            const salesMap: Record<string, number> = {};
            if (allSalesData) {
                allSalesData.forEach((item: any) => {
                    const pid = item.product_id;
                    salesMap[pid] = (salesMap[pid] || 0) + item.quantity;
                });
            }

            // Update processedItems with sold count
            const finalItems = processedItems.map(item => ({
                ...item,
                sold: salesMap[item.id] || 0
            }));

            // Calculate KPIs
            const tItems = finalItems.reduce((sum, item) => sum + item.totalStock, 0);
            const tValue = finalItems.reduce((sum, item) => sum + item.value, 0);
            const tCost = finalItems.reduce((sum, item) => sum + item.costValue, 0);
            const lowCount = finalItems.filter(i => i.status === 'low').length;
            const outCount = finalItems.filter(i => i.status === 'out').length;

            setStockItems(finalItems);
            setTotalItems(tItems);
            setTotalValue(tValue);
            setTotalCost(tCost);
            setTotalPotentialProfit(tValue - tCost);
            setLowStockCount(lowCount);
            setOutStockCount(outCount);

            // 4. Fetch Best Sellers (Last 30 Days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: orderItems } = await supabase
                .from('order_items')
                .select(`
          quantity,
          subtotal,
          products!inner(name)
        `)
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (orderItems) {
                const aggregated = orderItems.reduce((acc: Record<string, BestSeller>, item: any) => {
                    const name = item.products?.name || 'Unknown';
                    if (!acc[name]) {
                        acc[name] = { name, quantity: 0, revenue: 0 };
                    }
                    acc[name].quantity += item.quantity;
                    acc[name].revenue += item.subtotal;
                    return acc;
                }, {});

                const sorted = Object.values(aggregated)
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 5); // Top 5

                setBestSellers(sorted);
            }

        } catch (error) {
            console.error("Error fetching stock data:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = stockItems
        .filter(item => {
            if (filter === 'low') return item.status === 'low';
            if (filter === 'out') return item.status === 'out';
            return true;
        })
        .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6 animate-fadeIn pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-amber-600" />
                        {t('nav.stock-analytics')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('stock.subtitle')}</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                        <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">{t('stock.total_items')}</p>
                        <h3 className="text-2xl font-black text-gray-900">{totalItems}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">{t('stock.total_value')}</p>
                        <h3 className="text-2xl font-black text-gray-900">{formatCurrency(totalValue)}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-xl">
                        <AlertCircle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">{t('stock.low_stock')}</p>
                        <h3 className="text-2xl font-black text-gray-900">{lowStockCount}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">{t('stock.out_of_stock')}</p>
                        <h3 className="text-2xl font-black text-gray-900">{outStockCount}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">{t('stock.total_cost')}</p>
                        <h3 className="text-2xl font-black text-gray-900">{formatCurrency(totalCost)}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">{t('stock.potential_profit')}</p>
                        <h3 className="text-2xl font-black text-gray-900">{formatCurrency(totalPotentialProfit)}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Stock Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Archive className="w-5 h-5 text-gray-500" />
                            {t('stock.inventory_status')}
                        </h2>

                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={t('common.search')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-48"
                                />
                            </div>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50"
                            >
                                <option value="all">{t('Todos')}</option>
                                <option value="low">{t('stock.low_stock')}</option>
                                <option value="out">{t('stock.out_of_stock')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Producto')}</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('Stock')}</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('Vendidos')}</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Valor Venta')}</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('Estado')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">{t('common.loading')}</td></tr>
                                ) : filteredItems.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">{t('No se encontraron productos')}</td></tr>
                                ) : (
                                    filteredItems.map(item => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedItem(item)}
                                        >
                                            <td className="px-4 py-3 flex items-center gap-3">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-cover rounded-lg" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                                        <Package className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <span className="font-medium text-gray-900">{item.name}</span>
                                                {item.sizes && item.sizes.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.sizes.map((s, idx) => (
                                                            <span key={idx} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                                {s.name}: {s.stock}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-700">{item.totalStock}</td>
                                            <td className="px-4 py-3 text-center font-medium text-blue-600">{item.sold}</td>
                                            <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.value)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {item.status === 'out' && (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
                                                        {t('stock.out_of_stock')}
                                                    </span>
                                                )}
                                                {item.status === 'low' && (
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
                                                        {t('stock.low_stock')}
                                                    </span>
                                                )}
                                                {item.status === 'ok' && (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200">
                                                        OK
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Best Sellers */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-fit">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        {t('stock.best_sellers')} (30d)
                    </h2>

                    <div className="space-y-4">
                        {loading ? (
                            <p className="text-gray-500 text-center py-4">{t('common.loading')}</p>
                        ) : bestSellers.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">{t('No hay datos de ventas recientes')}</p>
                        ) : (
                            bestSellers.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm line-clamp-1">{item.name}</p>
                                            <p className="text-xs text-gray-500">{item.quantity} {t('unidades')}</p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-green-600 text-sm">{formatCurrency(item.revenue)}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn">
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Archive className="w-5 h-5 text-purple-600" />
                                {selectedItem.name}
                            </h3>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            <IndividualUnitsManager
                                productId={selectedItem.id}
                                productName={selectedItem.name}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
