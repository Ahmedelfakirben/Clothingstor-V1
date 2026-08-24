import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  X, Calendar, ShoppingCart, Info, TrendingUp, Package,
  RotateCcw, Plus, Minus, CheckCircle, AlertTriangle,
  ChevronLeft, RefreshCw, Tag, Filter
} from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface ProductHistoryModalProps {
  productId: string;
  productName: string;
  currentStock: number;
  onClose: () => void;
}

interface HistoryEvent {
  id: string;
  type: 'creation' | 'sale' | 'validation' | 'return' | 'manual_add' | 'manual_deduct';
  date: string;
  quantity: number;
  price?: number;
  employeeName?: string;
  sizeName?: string;
  sizeId?: string;
  reason?: string;
  orderId?: string;
  orderNumber?: number;
  returnId?: string;
  stockAfterBySizeOrTotal?: number;
}

interface OrderDetail {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  total: number;
  payment_method?: string;
  employee_name?: string;
  items: { name: string; size_name?: string; quantity: number; unit_price: number; image_url?: string }[];
}

interface ReturnDetail {
  id: string;
  created_at: string;
  quantity_returned: number;
  unit_price: number;
  total_refund: number;
  reason?: string;
  size_name?: string;
  returned_by_name?: string;
  order_number?: number;
}

export default function ProductHistoryModal({ productId, productName, currentStock, onClose }: ProductHistoryModalProps) {
  const { currentLanguage } = useLanguage();
  const isFr = currentLanguage === 'fr';
  const tf = (es: string, fr: string) => isFr ? fr : es;
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [totalSold, setTotalSold] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);
  const [totalManualAdds, setTotalManualAdds] = useState(0);
  const [realStock, setRealStock] = useState<number>(currentStock);
  const [hasSizes, setHasSizes] = useState(false);
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [returnDetail, setReturnDetail] = useState<ReturnDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { fetchHistory(); }, [productId]);

  const extractSizeFromReason = (reason?: string): string | null => {
    if (!reason) return null;
    const match = reason.match(/Taille supprim[eé]e?:\s*(.+)|Talla eliminada:\s*(.+)/i);
    return match?.[1]?.trim() || match?.[2]?.trim() || null;
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let timeline: HistoryEvent[] = [];

      const { data: sizesData } = await supabase
        .from('product_sizes').select('stock, size_name').eq('product_id', productId);
      const hasSizesResult = Boolean(sizesData && sizesData.length > 0);
      setHasSizes(hasSizesResult);
      const realStockCalc = hasSizesResult
        ? sizesData!.reduce((sum, s) => sum + (s.stock || 0), 0)
        : currentStock;
      setRealStock(realStockCalc);

      const { data: profiles } = await supabase.from('employee_profiles').select('id, full_name');
      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('created_at, created_by, validated_by, stock, product_sizes(size_name, stock)')
        .eq('id', productId).single();

      if (productData && !productError) {
        const sizesInfo = (productData.product_sizes as any[])?.length > 0
          ? (productData.product_sizes as any[]).map(s => `${s.size_name}: ${s.stock}`).join(', ')
          : `Stock: ${productData.stock || 0}`;
        timeline.push({
          id: 'creation', type: 'creation', date: productData.created_at,
          quantity: productData.stock || 0, sizeName: sizesInfo,
          employeeName: productData.created_by
            ? profileMap.get(productData.created_by) || tf('Sistema', 'Systeme')
            : tf('Administrador', 'Administrateur'),
        });
        if (productData.validated_by) {
          timeline.push({
            id: 'validation', type: 'validation', date: productData.created_at, quantity: 0,
            employeeName: profileMap.get(productData.validated_by) || tf('Administrador', 'Administrateur'),
          });
        }
      }

      const { data: salesData, error: salesError } = await supabase
        .from('order_items')
        .select('id, quantity, unit_price, product_sizes(size_name, id), orders!inner(id, status, created_at, employee_id, order_number)')
        .eq('product_id', productId);
      let soldUnits = 0;
      if (!salesError && salesData) {
        salesData.forEach((item: any) => {
          if (item.orders?.status === 'completed') {
            soldUnits += item.quantity;
            timeline.push({
              id: item.id, type: 'sale', date: item.orders.created_at,
              quantity: item.quantity, price: item.unit_price,
              sizeName: item.product_sizes?.size_name, sizeId: item.product_sizes?.id,
              orderId: item.orders.id, orderNumber: item.orders.order_number,
              employeeName: item.orders.employee_id
                ? profileMap.get(item.orders.employee_id) || tf('Vendedor', 'Vendeur')
                : tf('Sin Asignar', 'Non Assigne'),
            });
          }
        });
      }

      const { data: returnsData } = await supabase
        .from('order_returns')
        .select('id, created_at, quantity_returned, unit_price, reason, returned_by, product_sizes(size_name, id), orders(order_number)')
        .eq('product_id', productId);
      let returnUnits = 0;
      if (returnsData) {
        returnsData.forEach((ret: any) => {
          soldUnits -= ret.quantity_returned;
          returnUnits += ret.quantity_returned;
          timeline.push({
            id: ret.id, type: 'return', date: ret.created_at,
            quantity: ret.quantity_returned, price: ret.unit_price,
            sizeName: ret.product_sizes?.size_name, sizeId: ret.product_sizes?.id,
            reason: ret.reason, returnId: ret.id, orderNumber: ret.orders?.order_number,
            employeeName: profileMap.get(ret.returned_by) || tf('Empleado', 'Employe'),
          });
        });
      }

      const { data: movementsData } = await supabase
        .from('stock_movements')
        .select('id, created_at, quantity, type, reason, employee_id, product_sizes(size_name, id)')
        .eq('product_id', productId);
      let manualAdds = 0;
      if (movementsData) {
        movementsData.forEach((mov: any) => {
          if (mov.type === 'manual_add') manualAdds += mov.quantity;
          timeline.push({
            id: mov.id, type: mov.type as any, date: mov.created_at,
            quantity: mov.quantity, sizeName: mov.product_sizes?.size_name,
            sizeId: mov.product_sizes?.id, reason: mov.reason,
            employeeName: profileMap.get(mov.employee_id) || tf('Sistema', 'Systeme'),
          });
        });
      }

      setTotalSold(Math.max(0, soldUnits));
      setTotalReturns(returnUnits);
      setTotalManualAdds(manualAdds);

      timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const stockMap = new Map<string, number>();
      timeline.forEach(ev => {
        let sizeKey = ev.sizeName;
        if (!sizeKey) {
          const extracted = extractSizeFromReason(ev.reason);
          if (extracted) sizeKey = extracted;
        }
        const key = sizeKey && !sizeKey.includes(':') ? sizeKey : '__total__';
        const prev = stockMap.get(key) || 0;
        let delta = 0;
        if (ev.type === 'creation') delta = ev.quantity;
        else if (ev.type === 'sale') delta = -ev.quantity;
        else if (ev.type === 'return') delta = ev.quantity;
        else if (ev.type === 'manual_add') delta = ev.quantity;
        else if (ev.type === 'manual_deduct') delta = -Math.abs(ev.quantity);
        const after = prev + delta;
        stockMap.set(key, after);
        ev.stockAfterBySizeOrTotal = after;
      });

      const sizes = [...new Set(
        timeline.map(ev => {
          if (ev.sizeName && !ev.sizeName.includes(':')) return ev.sizeName;
          return extractSizeFromReason(ev.reason);
        }).filter((s): s is string => !!s)
      )];
      setAvailableSizes(sizes);
      timeline.reverse();
      setEvents(timeline);
    } catch (err) {
      console.error('Error fetching product history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetail = async (orderId: string) => {
    setDetailLoading(true);
    try {
      const { data } = await supabase.from('orders')
        .select('id, order_number, created_at, status, total, payment_method, employee_id, order_items(quantity, unit_price, products(name, image_url), product_sizes(size_name))')
        .eq('id', orderId).single();
      if (!data) return;
      const { data: empData } = await supabase.from('employee_profiles').select('full_name').eq('id', data.employee_id).single();
      setOrderDetail({
        id: data.id, order_number: data.order_number, created_at: data.created_at,
        status: data.status, total: data.total, payment_method: data.payment_method,
        employee_name: empData?.full_name,
        items: (data.order_items || []).map((oi: any) => ({
          name: oi.products?.name || '--', size_name: oi.product_sizes?.size_name,
          quantity: oi.quantity, unit_price: oi.unit_price, image_url: oi.products?.image_url,
        })),
      });
    } catch (err) { console.error(err); } finally { setDetailLoading(false); }
  };

  const fetchReturnDetail = async (returnId: string) => {
    setDetailLoading(true);
    try {
      const { data } = await supabase.from('order_returns')
        .select('id, created_at, quantity_returned, unit_price, total_refund, reason, returned_by, product_sizes(size_name), orders(order_number)')
        .eq('id', returnId).single();
      if (!data) return;
      const { data: empData } = await supabase.from('employee_profiles').select('full_name').eq('id', data.returned_by).single();
      const returnData = data as any;
      const orderNum = Array.isArray(returnData?.orders)
        ? returnData.orders[0]?.order_number
        : returnData?.orders?.order_number;
      const sizeName = Array.isArray(returnData?.product_sizes)
        ? returnData.product_sizes[0]?.size_name
        : returnData?.product_sizes?.size_name;

      setReturnDetail({
        id: data.id, created_at: data.created_at, quantity_returned: data.quantity_returned,
        unit_price: data.unit_price, total_refund: data.total_refund, reason: data.reason,
        size_name: sizeName, returned_by_name: empData?.full_name,
        order_number: orderNum,
      });
    } catch (err) { console.error(err); } finally { setDetailLoading(false); }
  };

  const handleEventClick = (ev: HistoryEvent) => {
    if (ev.type === 'sale' && ev.orderId) {
      setSelectedEvent(ev); setOrderDetail(null); setReturnDetail(null);
      fetchOrderDetail(ev.orderId);
    } else if (ev.type === 'return' && ev.returnId) {
      setSelectedEvent(ev); setOrderDetail(null); setReturnDetail(null);
      fetchReturnDetail(ev.returnId);
    }
  };

  const closeDetail = () => { setSelectedEvent(null); setOrderDetail(null); setReturnDetail(null); };

  const filteredEvents = useMemo(() => {
    if (sizeFilter === 'all') return events;
    return events.filter(ev => {
      if (ev.type === 'creation' || ev.type === 'validation') return true;
      const size = ev.sizeName || extractSizeFromReason(ev.reason);
      return size === sizeFilter;
    });
  }, [events, sizeFilter]);

  const groupedByMonth = useMemo(() => {
    const groups: { label: string; events: HistoryEvent[] }[] = [];
    let cur = '';
    filteredEvents.forEach(ev => {
      const label = new Date(ev.date).toLocaleString(isFr ? 'fr-FR' : 'es-ES', { month: 'long', year: 'numeric' });
      if (label !== cur) { cur = label; groups.push({ label, events: [] }); }
      groups[groups.length - 1].events.push(ev);
    });
    return groups;
  }, [filteredEvents, isFr]);

  const isPromoEvent = (ev: HistoryEvent) => {
    return ev.reason?.includes('Promoción') || ev.reason?.includes('Promotion') || ev.reason?.includes('🔥') || ev.reason?.includes('🚫') || ev.reason?.includes('✏️');
  };

  const getIcon = (ev: HistoryEvent) => {
    const cls = 'w-4 h-4';
    if (isPromoEvent(ev)) return <Tag className={cls} />;
    switch (ev.type) {
      case 'creation': return <Package className={cls} />;
      case 'validation': return <CheckCircle className={cls} />;
      case 'sale': return <ShoppingCart className={cls} />;
      case 'return': return <RotateCcw className={cls} />;
      case 'manual_add': return <Plus className={cls} />;
      case 'manual_deduct': return <Minus className={cls} />;
    }
  };

  const getColors = (ev: HistoryEvent) => {
    if (isPromoEvent(ev)) {
      return { dot: 'bg-amber-500', icon: 'bg-amber-100 text-amber-600', title: 'text-amber-700', border: 'border-amber-200' };
    }
    switch (ev.type) {
      case 'creation': return { dot: 'bg-blue-500', icon: 'bg-blue-100 text-blue-600', title: 'text-blue-700', border: 'border-blue-100' };
      case 'validation': return { dot: 'bg-purple-500', icon: 'bg-purple-100 text-purple-600', title: 'text-purple-700', border: 'border-purple-100' };
      case 'sale': return { dot: 'bg-green-500', icon: 'bg-green-100 text-green-600', title: 'text-green-700', border: 'border-green-100' };
      case 'return': return { dot: 'bg-orange-500', icon: 'bg-orange-100 text-orange-600', title: 'text-orange-700', border: 'border-orange-100' };
      case 'manual_add': return { dot: 'bg-cyan-500', icon: 'bg-cyan-100 text-cyan-600', title: 'text-cyan-700', border: 'border-cyan-100' };
      case 'manual_deduct': return { dot: 'bg-red-400', icon: 'bg-red-100 text-red-600', title: 'text-red-700', border: 'border-red-100' };
    }
  };

  const getTitle = (ev: HistoryEvent) => {
    if (isPromoEvent(ev)) {
      return tf('Promoción de Producto', 'Promotion de Produit');
    }
    switch (ev.type) {
      case 'creation': return tf('Producto Registrado', 'Produit Enregistre');
      case 'validation': return tf('Producto Validado', 'Produit Valide');
      case 'sale': return tf('Venta Completada', 'Vente Realisee');
      case 'return': return tf('Devolucion Realizada', 'Retour Realise');
      case 'manual_add': return tf('Stock Anadido', 'Stock Ajoute');
      case 'manual_deduct': return tf('Stock Retirado', 'Stock Retire');
    }
  };

  const renderSizeBadge = (ev: HistoryEvent) => {
    if (ev.type === 'creation' || ev.type === 'validation') return null;
    let label: string, badgeClass: string, extra = null;
    if (ev.sizeName && !ev.sizeName.includes(':')) {
      label = ev.sizeName; badgeClass = 'bg-indigo-100 text-indigo-700';
    } else {
      const extracted = extractSizeFromReason(ev.reason);
      if (extracted) {
        label = extracted; badgeClass = 'bg-amber-100 text-amber-700';
        extra = <span className="opacity-70">🗑</span>;
      } else {
        label = tf('Sin talla', 'Sans taille'); badgeClass = 'bg-gray-100 text-gray-500 italic';
      }
    }
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
        <Tag className="w-3 h-3" />{label}{extra}
      </span>
    );
  };

  const isClickable = (ev: HistoryEvent) =>
    (ev.type === 'sale' && !!ev.orderId) || (ev.type === 'return' && !!ev.returnId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />{tf('Historial del Producto', 'Historique du Produit')}
            </h3>
            <p className="text-blue-100 text-sm mt-1 font-medium">{productName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchHistory} className="text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors" title={tf('Actualizar', 'Actualiser')}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-500 font-medium animate-pulse">{tf('Analizando registros...', 'Analyse des registres...')}</p>
            </div>
          ) : selectedEvent ? (
            <div className="space-y-4">
              <button onClick={closeDetail} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                <ChevronLeft className="w-4 h-4" />{tf('Volver al historial', "Retour a l'historique")}
              </button>
              {detailLoading ? (
                <div className="flex items-center justify-center h-48"><LoadingSpinner size="lg" /></div>
              ) : orderDetail ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 px-5 py-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wide">Commande</p>
                        <p className="text-2xl font-black text-gray-900">#{String(orderDetail.order_number).padStart(3, '0')}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{new Date(orderDetail.created_at).toLocaleString(isFr ? 'fr-FR' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-green-700">{formatCurrency(orderDetail.total)}</p>
                        {orderDetail.payment_method && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{orderDetail.payment_method}</span>}
                      </div>
                    </div>
                    {orderDetail.employee_name && <p className="text-xs text-gray-600 mt-2">{tf('Atendido por:', 'Servi par:')} <span className="font-bold text-gray-800">{orderDetail.employee_name}</span></p>}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {orderDetail.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                          {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-4 h-4" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                          {item.size_name && <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">{item.size_name}</span>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(item.unit_price)}</p>
                          <p className="text-xs text-gray-500">x{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : returnDetail ? (
                <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 px-5 py-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">Retour</p>
                        {returnDetail.order_number && <p className="text-sm text-gray-500">Commande #{String(returnDetail.order_number).padStart(3, '0')}</p>}
                        <p className="text-xs text-gray-500 mt-0.5">{new Date(returnDetail.created_at).toLocaleString(isFr ? 'fr-FR' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </div>
                      <p className="text-2xl font-black text-orange-700">-{formatCurrency(returnDetail.total_refund)}</p>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">{tf('Cantidad devuelta:', 'Quantite retournee:')}</span><span className="font-bold text-orange-700">{returnDetail.quantity_returned} unid.</span></div>
                    {returnDetail.size_name && <div className="flex justify-between"><span className="text-gray-500">{tf('Talla:', 'Taille:')}</span><span className="font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{returnDetail.size_name}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">{tf('Precio unitario:', 'Prix unitaire:')}</span><span className="font-bold text-gray-900">{formatCurrency(returnDetail.unit_price)}</span></div>
                    {returnDetail.reason && <div className="flex justify-between"><span className="text-gray-500">{tf('Motivo:', 'Motif:')}</span><span className="font-medium text-gray-700 text-right max-w-xs">{returnDetail.reason}</span></div>}
                    {returnDetail.returned_by_name && <div className="flex justify-between"><span className="text-gray-500">{tf('Procesado por:', 'Traite par:')}</span><span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">{returnDetail.returned_by_name}</span></div>}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                  <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600"><Info className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">{tf('Stock Actuel en Tienda', 'Stock Actuel en Magasin')}</p>
                    <p className="text-2xl font-black text-gray-900">{realStock}</p>
                    {hasSizes && realStock !== currentStock && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3" />{tf('Campo base:', 'Champ base:')} {currentStock}
                      </p>
                    )}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                  <div className="bg-green-100 p-2.5 rounded-lg text-green-600"><ShoppingCart className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">{tf('Total Vendidas (neto)', 'Total Vendues (net)')}</p>
                    <p className="text-2xl font-black text-gray-900">{totalSold}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                  <div className="bg-orange-100 p-2.5 rounded-lg text-orange-600"><RotateCcw className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">{tf('Total Retours', 'Total Retours')}</p>
                    <p className="text-2xl font-black text-gray-900">{totalReturns}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                  <div className="bg-cyan-100 p-2.5 rounded-lg text-cyan-600"><Plus className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">{tf('Anadido Manualmente', 'Ajoute Manuellement')}</p>
                    <p className="text-2xl font-black text-gray-900">{totalManualAdds}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="font-semibold text-gray-700">{tf('Linea de Tiempo de Movimientos', 'Chronologie des Mouvements')}</h4>
                  {availableSizes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-gray-400" />
                      <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400 outline-none">
                        <option value="all">{tf('Todas las tallas', 'Toutes les tailles')}</option>
                        {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="p-5 max-h-[50vh] overflow-y-auto">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p>{tf('No hay registros disponibles.', 'Aucun enregistrement disponible.')}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupedByMonth.map(group => (
                        <div key={group.label}>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="h-px flex-1 bg-gray-200" />
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider capitalize">{group.label}</span>
                            <div className="h-px flex-1 bg-gray-200" />
                          </div>
                          <div className="relative border-l-2 border-gray-200 ml-3 space-y-4">
                            {group.events.map((ev, idx) => {
                              const colors = getColors(ev);
                              const clickable = isClickable(ev);
                              const promoEvent = isPromoEvent(ev);
                              return (
                                <div key={ev.id + idx} className="relative pl-6">
                                  <div className={`absolute -left-[9px] top-3 h-4 w-4 rounded-full border-2 border-white shadow-sm ${colors.dot}`} />
                                  <div
                                    className={`bg-white p-4 rounded-lg border ${colors.border} shadow-sm transition-all ${clickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''}`}
                                    onClick={() => clickable && handleEventClick(ev)}
                                  >
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`p-1.5 rounded-lg ${colors.icon}`}>{getIcon(ev)}</span>
                                        <h5 className={`font-bold text-sm ${colors.title}`}>
                                          {getTitle(ev)}
                                          {clickable && <span className="ml-1 text-xs opacity-50"> &#8599;</span>}
                                        </h5>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {ev.stockAfterBySizeOrTotal !== undefined && ev.type !== 'validation' && !promoEvent && (
                                          <span className="text-xs bg-gray-100 text-gray-600 font-mono px-2 py-0.5 rounded-full border border-gray-200">
                                            📦 {ev.stockAfterBySizeOrTotal}
                                          </span>
                                        )}
                                        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                          {new Date(ev.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mb-2">{renderSizeBadge(ev)}</div>
                                    <div className="text-sm text-gray-600 space-y-1">
                                      {promoEvent ? (
                                        <>
                                          <p className="font-semibold text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 inline-block text-xs">
                                            {ev.reason}
                                          </p>
                                          <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">{tf('Por:', 'Par:')} </span><span className="font-bold text-amber-700">{ev.employeeName}</span></p>
                                        </>
                                      ) : ev.type === 'creation' ? (
                                        <>
                                          <p>{tf('Ingresado por:', 'Saisi par:')} <span className={`font-bold ${colors.title}`}>{ev.employeeName}</span></p>
                                          <p className="text-xs text-blue-600 font-bold">{ev.sizeName}</p>
                                        </>
                                      ) : ev.type === 'validation' ? (
                                        <p>{tf('Aprobado por:', 'Approuve par:')} <span className="font-bold text-purple-700">{ev.employeeName}</span></p>
                                      ) : ev.type === 'return' ? (
                                        <>
                                          <p><span className="font-medium text-gray-700">{tf('Cantidad devuelta:', 'Quantite retournee:')} </span><span className="text-orange-600 font-bold">+{ev.quantity} unid.</span></p>
                                          <p><span className="font-medium text-gray-700">{tf('Motivo:', 'Motif:')} </span>{ev.reason || '--'}</p>
                                          <p><span className="font-medium text-gray-700">{tf('Por:', 'Par:')} </span><span className="font-bold text-orange-700">{ev.employeeName}</span></p>
                                        </>
                                      ) : ev.type === 'manual_add' || ev.type === 'manual_deduct' ? (
                                        <>
                                          <p>
                                            <span className="font-medium text-gray-700">{ev.type === 'manual_add' ? tf('Anadido:', 'Ajoute:') : tf('Retirado:', 'Retire:')} </span>
                                            <span className={`font-bold ${ev.type === 'manual_add' ? 'text-cyan-600' : 'text-red-600'}`}>
                                              {ev.type === 'manual_add' ? '+' : '-'}{Math.abs(ev.quantity)} unid.
                                            </span>
                                          </p>
                                          <p><span className="font-medium text-gray-700">{tf('Motivo:', 'Motif:')} </span>{ev.reason || tf('Ajuste manual', 'Ajustement manuel')}</p>
                                          <p><span className="font-medium text-gray-700">{tf('Por:', 'Par:')} </span><span className={`font-bold ${ev.type === 'manual_add' ? 'text-cyan-700' : 'text-red-700'}`}>{ev.employeeName}</span></p>
                                        </>
                                      ) : (
                                        <>
                                          <p><span className="font-medium text-gray-700">{tf('Cantidad:', 'Quantite:')} </span><span className="text-red-600 font-bold">-{ev.quantity} unid.</span></p>
                                          {ev.price !== undefined && <p><span className="font-medium text-gray-700">{tf('Precio unitario:', 'Prix unitaire:')} </span>{formatCurrency(ev.price)}</p>}
                                          {ev.orderNumber && <p><span className="font-medium text-gray-700">Commande: </span>#{String(ev.orderNumber).padStart(3, '0')}</p>}
                                          <p><span className="font-medium text-gray-700">{tf('Atendido por:', 'Servi par:')} </span><span className="font-bold text-green-700">{ev.employeeName}</span></p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button onClick={selectedEvent ? closeDetail : onClose} className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors">
            {selectedEvent ? tf('Volver', 'Retour') : tf('Cerrar', 'Fermer')}
          </button>
        </div>
      </div>
    </div>
  );
}
